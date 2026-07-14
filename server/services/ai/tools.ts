import type { H3Event } from 'h3'
import { tool, zodSchema } from 'ai'
import { z } from 'zod'
import type { AuthUser } from '~/types/auth'
import { ROLE_CAPABILITIES } from '~/utils/constants/permissions'
import {
  aiToolGetBillingPeriodOverviewSchema,
  aiToolCalculateBillingDraftSchema,
  aiToolGetMeterStatusSchema,
  aiToolListBuildingsSchema,
  aiToolPlanOpenBillingPeriodSchema,
  aiToolPlanMeterReadingUpdateSchema,
  aiToolPreviewMeterImportSchema,
  aiToolPlanUtilityUsageOverrideSchema,
  aiToolPlanInvoiceIssueSchema,
  aiToolPlanPaidInvoiceAdjustmentSchema,
  aiToolPlanReissueInvoiceSchema,
  aiToolPlanVoidInvoiceSchema,
} from '~/utils/validators/ai'
import { getAssignedBuildingIds } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { emitAiTelemetry } from '../../utils/ai-telemetry'
import { MeterReadingService } from '../meter-readings'
import { BillingPeriodService } from '../billing/periods'
import { AiBuildingService } from './buildings'
import { AiBillingPeriodPlanner } from './billing-period-planner'
import { AiMeterPlanner } from './meter-planner'
import { BillingDraftService } from '../billing/drafts'
import { summarizeBillingDraft } from './draft-summary'
import { AiUtilityOverridePlanner } from './utility-override-planner'
import { AiInvoiceIssuePlanner } from './invoice-issue-planner'
import { AiInvoiceCorrectionPlanner } from './invoice-correction-planner'
import type { AiRuntimePolicy } from '../../utils/ai-runtime'
import { isAiToolRuntimeEnabled } from '../../utils/ai-runtime'

export type AiToolMode = 'read' | 'plan'

export interface AiToolPolicy {
  name: string
  mode: AiToolMode
  requiredCapability: string
}

export interface AiToolContext {
  event: H3Event
  user: AuthUser
  conversationId: string
  currentUserMessageId: string
  requestId: string
  runtimePolicy?: AiRuntimePolicy
}

export const AI_TOOL_POLICIES = Object.freeze([
  { name: 'get_user_context', mode: 'read', requiredCapability: 'dashboard.read' },
  { name: 'list_buildings', mode: 'read', requiredCapability: 'buildings.read' },
  { name: 'get_meter_status', mode: 'read', requiredCapability: 'meter-readings.read' },
  { name: 'get_billing_period_overview', mode: 'read', requiredCapability: 'billing.read' },
  { name: 'calculate_billing_draft', mode: 'read', requiredCapability: 'billing.read' },
  { name: 'plan_open_billing_period', mode: 'plan', requiredCapability: 'billing.write' },
  { name: 'preview_meter_import', mode: 'plan', requiredCapability: 'meter-readings.write' },
  { name: 'plan_meter_reading_update', mode: 'plan', requiredCapability: 'meter-readings.write' },
  { name: 'plan_utility_usage_override', mode: 'plan', requiredCapability: 'billing.write' },
  { name: 'plan_invoice_issue', mode: 'plan', requiredCapability: 'billing.write' },
  { name: 'plan_void_invoice', mode: 'plan', requiredCapability: 'billing.corrections' },
  { name: 'plan_reissue_invoice', mode: 'plan', requiredCapability: 'billing.corrections' },
  { name: 'plan_paid_invoice_adjustment', mode: 'plan', requiredCapability: 'billing.corrections' },
] satisfies AiToolPolicy[])

async function runObserved<T>(ctx: AiToolContext, toolName: string, execute: () => Promise<T>): Promise<T> {
  const startedAt = Date.now()
  emitAiTelemetry(ctx.event, {
    event: 'ai.tool', requestId: ctx.requestId, conversationId: ctx.conversationId,
    toolName, outcome: 'started',
  })
  try {
    const result = await execute()
    emitAiTelemetry(ctx.event, {
      event: 'ai.tool', requestId: ctx.requestId, conversationId: ctx.conversationId,
      toolName, outcome: 'succeeded', durationMs: Date.now() - startedAt,
    })
    return result
  }
  catch (error) {
    emitAiTelemetry(ctx.event, {
      event: 'ai.tool', requestId: ctx.requestId, conversationId: ctx.conversationId,
      toolName, outcome: 'failed', durationMs: Date.now() - startedAt,
      errorCategory: 'INTERNAL_TOOL_FAILURE',
    })
    throw error
  }
}

export function allowedAiToolNames(user: AuthUser, runtimePolicy?: AiRuntimePolicy): string[] {
  return AI_TOOL_POLICIES
    .filter(policy => can(user, policy.requiredCapability))
    .filter(policy => !runtimePolicy || isAiToolRuntimeEnabled(runtimePolicy, policy))
    .map(policy => policy.name)
}

export function buildAiTools(ctx: AiToolContext) {
  const allowed = new Set(allowedAiToolNames(ctx.user, ctx.runtimePolicy))
  return {
    ...(allowed.has('get_user_context') ? {
      get_user_context: tool({
        description: 'Get current role and assigned building scope for the authenticated user.',
        inputSchema: zodSchema(z.object({})),
        execute: async () => runObserved(ctx, 'get_user_context', async () => {
          const role = ctx.user.app_metadata?.role ?? null
          const capabilities = role ? [...ROLE_CAPABILITIES[role]] : []
          const buildingIds = await getAssignedBuildingIds(ctx.event, ctx.user)
          return { role, capabilities, building_scope: buildingIds }
        }),
      }),
    } : {}),
    ...(allowed.has('list_buildings') ? {
      list_buildings: tool({
        description: 'List safe summaries of buildings in the authenticated user scope.',
        inputSchema: zodSchema(aiToolListBuildingsSchema),
        execute: async () => runObserved(ctx, 'list_buildings', async () => ({
          buildings: await AiBuildingService.list(ctx.event, ctx.user),
        })),
      }),
    } : {}),
    ...(allowed.has('get_meter_status') ? {
      get_meter_status: tool({
        description: 'Get room meter submission status for a building and period.',
        inputSchema: zodSchema(aiToolGetMeterStatusSchema),
        execute: async (args) => runObserved(ctx, 'get_meter_status', async () => {
          const now = new Date()
          const resolution = await AiBuildingService.resolve(ctx.event, ctx.user, args.building_ref)
          if (resolution.status !== 'resolved') return resolution
          const readings = await MeterReadingService.getBuildingStatus(
            ctx.event, ctx.user, resolution.building.id,
            args.period_year ?? now.getFullYear(), args.period_month ?? now.getMonth() + 1,
          )
          return { status: 'resolved' as const, building: resolution.building, readings }
        }),
      }),
    } : {}),
    ...(allowed.has('get_billing_period_overview') ? {
      get_billing_period_overview: tool({
        description: 'Get billing workspace overview for a period id.',
        inputSchema: zodSchema(aiToolGetBillingPeriodOverviewSchema),
        execute: async (args) => runObserved(ctx, 'get_billing_period_overview', () =>
          BillingPeriodService.getOverview(ctx.event, ctx.user, args.period_id)),
      }),
    } : {}),
    ...(allowed.has('calculate_billing_draft') ? {
      calculate_billing_draft: tool({
        description: 'Calculate a scoped server-authoritative billing draft and deterministic explanation. Read-only; never issues invoices.',
        inputSchema: zodSchema(aiToolCalculateBillingDraftSchema),
        execute: async args => runObserved(ctx, 'calculate_billing_draft', async () => {
          const draft = await BillingDraftService.calculateDraft(ctx.event, ctx.user, args.period_id)
          return { draft, explanation: summarizeBillingDraft(draft) }
        }),
      }),
    } : {}),
    ...(allowed.has('plan_open_billing_period') ? {
      plan_open_billing_period: tool({
        description: 'Plan opening a billing period. Never confirms or creates the period; ambiguous buildings require user clarification.',
        inputSchema: zodSchema(aiToolPlanOpenBillingPeriodSchema),
        execute: async (args) => runObserved(ctx, 'plan_open_billing_period', () =>
          AiBillingPeriodPlanner.planOpen(ctx.event, ctx.user, ctx.conversationId, args)),
      }),
    } : {}),
    ...(allowed.has('preview_meter_import') ? {
      preview_meter_import: tool({
        description: 'Parse meter rows only from the current stored user message, return warnings/blockers, and create a confirmation plan only when valid. Never accepts raw text or reading arrays.',
        inputSchema: zodSchema(aiToolPreviewMeterImportSchema),
        execute: async args => runObserved(ctx, 'preview_meter_import', () =>
          AiMeterPlanner.planImport(
            ctx.event, ctx.user, ctx.conversationId, ctx.currentUserMessageId, args,
          )),
      }),
    } : {}),
    ...(allowed.has('plan_meter_reading_update') ? {
      plan_meter_reading_update: tool({
        description: 'Plan a versioned correction to one existing meter reading. Never commits inside chat.',
        inputSchema: zodSchema(aiToolPlanMeterReadingUpdateSchema),
        execute: async args => runObserved(ctx, 'plan_meter_reading_update', () =>
          AiMeterPlanner.planUpdate(ctx.event, ctx.user, ctx.conversationId, args)),
      }),
    } : {}),
    ...(allowed.has('plan_utility_usage_override') ? {
      plan_utility_usage_override: tool({
        description: 'Plan a versioned utility usage override for one scoped room and period. Never commits inside chat.',
        inputSchema: zodSchema(aiToolPlanUtilityUsageOverrideSchema),
        execute: async args => runObserved(ctx, 'plan_utility_usage_override', () =>
          AiUtilityOverridePlanner.plan(ctx.event, ctx.user, ctx.conversationId, args)),
      }),
    } : {}),
    ...(allowed.has('plan_invoice_issue') ? {
      plan_invoice_issue: tool({
        description: 'Plan invoice issue from a fresh server-authoritative billing draft. Never accepts totals or charge lines and never commits inside chat.',
        inputSchema: zodSchema(aiToolPlanInvoiceIssueSchema),
        execute: async args => runObserved(ctx, 'plan_invoice_issue', () =>
          AiInvoiceIssuePlanner.plan(ctx.event, ctx.user, ctx.conversationId, args)),
      }),
    } : {}),
    ...(allowed.has('plan_void_invoice') ? {
      plan_void_invoice: tool({
        description: 'Plan voiding one exact unpaid invoice with a reason and current version. Never commits inside chat.',
        inputSchema: zodSchema(aiToolPlanVoidInvoiceSchema),
        execute: async args => runObserved(ctx, 'plan_void_invoice', () =>
          AiInvoiceCorrectionPlanner.planVoid(ctx.event, ctx.user, ctx.conversationId, args)),
      }),
    } : {}),
    ...(allowed.has('plan_reissue_invoice') ? {
      plan_reissue_invoice: tool({
        description: 'Plan a replacement for one exact void invoice using a fresh authoritative draft. Never commits inside chat.',
        inputSchema: zodSchema(aiToolPlanReissueInvoiceSchema),
        execute: async args => runObserved(ctx, 'plan_reissue_invoice', () =>
          AiInvoiceCorrectionPlanner.planReissue(ctx.event, ctx.user, ctx.conversationId, args)),
      }),
    } : {}),
    ...(allowed.has('plan_paid_invoice_adjustment') ? {
      plan_paid_invoice_adjustment: tool({
        description: 'Plan an explicit adjustment for a partial or paid invoice. Does not undo payments or perform refunds.',
        inputSchema: zodSchema(aiToolPlanPaidInvoiceAdjustmentSchema),
        execute: async args => runObserved(ctx, 'plan_paid_invoice_adjustment', () =>
          AiInvoiceCorrectionPlanner.planPaidAdjustment(ctx.event, ctx.user, ctx.conversationId, args)),
      }),
    } : {}),
  }
}
