import type { H3Event } from 'h3'
import { streamText, tool, isStepCount, zodSchema } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModelV4 } from '@ai-sdk/provider'
import { z } from 'zod'
import type { AuthUser } from '~/types/auth'
import {
  aiToolGetBillingPeriodOverviewSchema as getBillingPeriodOverviewSchema,
  aiToolGetMeterStatusSchema as getMeterStatusSchema,
  aiToolOpenBillingPeriodSchema as openBillingPeriodSchema,
} from '~/utils/validators/ai'
import { ROLE_CAPABILITIES } from '~/utils/constants/permissions'
import { getAssignedBuildingIds } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { MeterReadingService } from '../meter-readings'
import { BillingPeriodService } from '../billing/periods'

type ApiErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'INTERNAL'

type AgentErrorCategory =
  | 'TOOL_VALIDATION'
  | 'TOOL_NOT_ALLOWED'
  | 'CONFIRMATION_REQUIRED'
  | 'IDEMPOTENCY_REPLAY'
  | 'OPTIMISTIC_LOCK_CONFLICT'
  | 'LOOP_LIMIT_EXCEEDED'
  | 'INTERNAL_TOOL_FAILURE'

interface AgentErrorDetails {
  category: AgentErrorCategory
  toolName?: string
  retryable: boolean
  conversationId?: string
  requestId?: string
  details?: unknown
}

interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ToolContext {
  event: H3Event
  user: AuthUser
  conversationId: string
  requestId: string
}

interface ProviderConfig {
  provider: string
  groqApiKey: string
  googleApiKey: string
  modelPrimary: string
  modelFallback: string
  maxSteps: number
  maxOutputTokens: number
}

function throwAgentError(
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  info: AgentErrorDetails,
): never {
  throw createError({
    statusCode,
    data: {
      error: {
        code,
        message,
        details: info,
      },
    },
  })
}

function resolveConfig(runtime: ReturnType<typeof useRuntimeConfig>): ProviderConfig {
  return {
    provider: (runtime.aiProvider as string) || 'groq',
    groqApiKey: runtime.aiGroqApiKey as string,
    googleApiKey: runtime.aiGoogleApiKey as string,
    modelPrimary: (runtime.aiModel as string) || 'llama-3.3-70b-versatile',
    modelFallback: (runtime.aiModelFallback as string) || '',
    maxSteps: Number(runtime.aiMaxSteps ?? 8),
    maxOutputTokens: Number(runtime.aiMaxOutputTokens ?? 1200),
  }
}

function buildModel(config: ProviderConfig, modelName?: string): LanguageModelV4 {
  const model = modelName ?? config.modelPrimary

  if (config.provider === 'google') {
    if (!config.googleApiKey) {
      throw createError({ statusCode: 500, message: 'Thiếu cấu hình NUXT_AI_GOOGLE_API_KEY.' })
    }
    const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey })
    return google(model)
  }

  if (!config.groqApiKey) {
    throw createError({ statusCode: 500, message: 'Thiếu cấu hình NUXT_AI_GROQ_API_KEY.' })
  }
  const groq = createGroq({ apiKey: config.groqApiKey })
  return groq(model)
}

function buildSystemPrompt(): string {
  return [
    'You are an internal operations assistant for Zeno House.',
    'Use tools when data is required.',
    'Never invent tool output.',
    'After calling a tool, always summarize the result in natural language. Never leave a response empty.',
    'Respond in the same language the user writes in.',
    'For mutating tools, request explicit confirmation first.',
    'Do not attempt web browsing or external search.',
  ].join('\n')
}

function buildTools(ctx: ToolContext, user: AuthUser) {
  return {
    ...(can(user, 'dashboard.read') ? {
      get_user_context: tool({
        description: 'Get current role and assigned building scope for the authenticated user.',
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          const role = ctx.user.app_metadata?.role ?? null
          const capabilities = role ? [...ROLE_CAPABILITIES[role]] : []
          const buildingIds = await getAssignedBuildingIds(ctx.event, ctx.user)
          return { role, capabilities, building_scope: buildingIds }
        },
      }),
    } : {}),
    ...(can(user, 'meter-readings.read') ? {
      get_meter_status: tool({
        description: 'Get room meter submission status for a building and period.',
        inputSchema: zodSchema(getMeterStatusSchema),
        execute: async (args) => {
          const now = new Date()
          const year = args.period_year ?? now.getFullYear()
          const month = args.period_month ?? now.getMonth() + 1
          return MeterReadingService.getBuildingStatus(ctx.event, ctx.user, args.building_id, year, month)
        },
      }),
    } : {}),
    ...(can(user, 'billing.read') ? {
      get_billing_period_overview: tool({
        description: 'Get billing workspace overview for a period id.',
        inputSchema: zodSchema(getBillingPeriodOverviewSchema),
        execute: async (args) => {
          return BillingPeriodService.getOverview(ctx.event, ctx.user, args.period_id)
        },
      }),
    } : {}),
    ...(can(user, 'billing.write') ? {
      open_billing_period: tool({
        description: 'Open (or get existing) billing period. Requires explicit confirmation.',
        inputSchema: zodSchema(openBillingPeriodSchema),
        execute: async (args) => {
          if (!args.confirmed) {
            throwAgentError(422, 'VALIDATION_ERROR', 'Yêu cầu xác nhận trước khi mở kỳ vận hành.', {
              category: 'CONFIRMATION_REQUIRED',
              toolName: 'open_billing_period',
              retryable: true,
              conversationId: ctx.conversationId,
              requestId: ctx.requestId,
            })
          }
          if (!args.idempotency_key) {
            throwAgentError(422, 'VALIDATION_ERROR', 'Thiếu idempotency key cho thao tác ghi dữ liệu.', {
              category: 'TOOL_VALIDATION',
              toolName: 'open_billing_period',
              retryable: false,
              conversationId: ctx.conversationId,
              requestId: ctx.requestId,
            })
          }
          return BillingPeriodService.openOrGet(ctx.event, ctx.user, {
            building_id: args.building_id,
            period_year: args.period_year,
            period_month: args.period_month,
          })
        },
      }),
    } : {}),
  }
}

export async function streamAiChat(
  event: H3Event,
  user: AuthUser,
  input: { id: string; messages: AiChatMessage[] },
): Promise<Response> {
  const runtime = useRuntimeConfig(event)
  const config = resolveConfig(runtime)

  const requestId = getRequestHeader(event, 'x-request-id') ?? crypto.randomUUID()
  const ctx: ToolContext = { event, user, conversationId: input.id, requestId }
  const tools = buildTools(ctx, user)
  const hasTools = Object.keys(tools).length > 0
  const model = buildModel(config)

  const result = streamText({
    model,
    system: buildSystemPrompt(),
    messages: input.messages,
    ...(hasTools && { tools, stopWhen: isStepCount(config.maxSteps) }),
  })

  return result.toTextStreamResponse({
    headers: {
      'X-AI-Model': config.modelPrimary,
      'X-Conversation-Id': input.id,
    },
  })
}
