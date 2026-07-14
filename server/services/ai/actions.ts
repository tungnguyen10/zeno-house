import type { H3Event } from 'h3'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { aiActionPlanCreateSchema, type AiActionPlanCreateInput } from '~/utils/validators/ai'
import { AiActionPlanRepository } from '../../repositories/ai/actions'
import { AiConversationRepository } from '../../repositories/ai/conversations'
import { assertBuildingScope } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { emitAiTelemetry } from '../../utils/ai-telemetry'
import { hashAgentPayload, normalizeAgentFailure, readAgentErrorDetails, throwAgentError } from '../../utils/ai'
import { AI_ACTION_EXECUTORS, type AiActionExecutorRegistry } from './executors'
import { getAiRuntimePolicy, isAiActionRuntimeEnabled } from '../../utils/ai-runtime'
import { enforceAiRateLimit } from './rate-limit'

interface ActionResult {
  plan: AiActionPlan
  replayed: boolean
}

function requestId(event: H3Event): string {
  return getRequestHeader(event, 'x-request-id') ?? crypto.randomUUID()
}

function conflictForPlan(plan: AiActionPlan): never {
  const expired = plan.status === 'expired' || Date.parse(plan.expiresAt) <= Date.now()
  throwAgentError(409, 'CONFLICT', expired ? 'Kế hoạch thao tác đã hết hạn.' : 'Kế hoạch thao tác không còn khả dụng.', {
    category: expired ? 'ACTION_EXPIRED' : 'ACTION_NOT_EXECUTABLE',
    retryable: expired,
    actionPlanId: plan.id,
    conversationId: plan.conversationId,
  })
}

export const AiActionService = {
  async createPlan(event: H3Event, user: AuthUser, rawInput: AiActionPlanCreateInput): Promise<AiActionPlan> {
    const parsed = aiActionPlanCreateSchema.safeParse(rawInput)
    if (!parsed.success) throwValidationError('Kế hoạch thao tác AI không hợp lệ', parsed.error.flatten())
    const input = parsed.data

    const conversation = await AiConversationRepository.findOwnedById(event, input.conversation_id, user.id)
    if (!conversation || conversation.status !== 'active' || Date.parse(conversation.expiresAt) <= Date.now()) {
      throwNotFound('Không tìm thấy hội thoại AI đang hoạt động')
    }
    if (input.building_id) await assertBuildingScope(event, user, input.building_id, 'write')

    const plan = await AiActionPlanRepository.create(event, {
      conversationId: conversation.id,
      userId: user.id,
      buildingId: input.building_id ?? null,
      actionType: input.action_type,
      title: input.title,
      summary: input.summary,
      normalizedPayload: input.normalized_payload,
      payloadHash: hashAgentPayload(input.normalized_payload, input.resource_versions),
      preview: input.preview,
      warnings: input.warnings,
      resourceVersions: input.resource_versions,
      expiresAt: new Date(Date.now() + input.expires_in_seconds * 1000).toISOString(),
    })
    emitAiTelemetry(event, {
      event: 'ai.action', requestId: requestId(event), conversationId: conversation.id,
      actionPlanId: plan.id, actionType: plan.actionType, outcome: 'started',
    })
    return plan
  },

  async confirm(
    event: H3Event,
    user: AuthUser,
    planId: string,
    executors: AiActionExecutorRegistry = AI_ACTION_EXECUTORS,
  ): Promise<ActionResult> {
    const existing = await AiActionPlanRepository.findOwnedById(event, planId, user.id)
    if (!existing) throwNotFound('Không tìm thấy kế hoạch thao tác')
    const runtimePolicy = getAiRuntimePolicy(event)
    await enforceAiRateLimit(event, {
      userId: user.id,
      scope: 'action',
      requestId: requestId(event),
      conversationId: existing.conversationId,
      policy: runtimePolicy,
    })
    if (existing.status === 'succeeded') {
      emitAiTelemetry(event, {
        event: 'ai.action', requestId: requestId(event), conversationId: existing.conversationId,
        actionPlanId: existing.id, actionType: existing.actionType, outcome: 'replayed',
      })
      return { plan: existing, replayed: true }
    }
    if (existing.status !== 'pending' || Date.parse(existing.expiresAt) <= Date.now()) conflictForPlan(existing)

    const executor = executors[existing.actionType]
    if (!executor) {
      throwAgentError(409, 'CONFLICT', 'Thao tác này chưa được bật.', {
        category: 'ACTION_NOT_EXECUTABLE', retryable: false, actionPlanId: existing.id,
        conversationId: existing.conversationId,
      })
    }
    if (!isAiActionRuntimeEnabled(runtimePolicy, existing.actionType)) {
      throwAgentError(409, 'CONFLICT', 'Thao tác AI này đang bị tạm dừng.', {
        category: 'ACTION_NOT_EXECUTABLE', retryable: true, actionPlanId: existing.id,
        conversationId: existing.conversationId,
      })
    }
    if (!can(user, executor.requiredCapability)) throwForbidden('Không có quyền xác nhận thao tác này')
    if (existing.buildingId) await assertBuildingScope(event, user, existing.buildingId, 'write')

    const claimed = await AiActionPlanRepository.claim(event, existing.id, user.id)
    if (!claimed) {
      const current = await AiActionPlanRepository.findOwnedById(event, existing.id, user.id)
      if (!current) throwNotFound('Không tìm thấy kế hoạch thao tác')
      if (current.status === 'succeeded') return { plan: current, replayed: true }
      conflictForPlan(current)
    }

    const context = { event, user, plan: claimed, idempotencyKey: claimed.idempotencyKey }
    const startedAt = Date.now()
    try {
      await executor.revalidate?.(context)
      const result = await executor.execute(context)
      const completed = await AiActionPlanRepository.complete(event, claimed.id, user.id, result)
      if (!completed) throw new Error('Action plan completion compare-and-set failed')
      emitAiTelemetry(event, {
        event: 'ai.action', requestId: requestId(event), conversationId: claimed.conversationId,
        actionPlanId: claimed.id, actionType: claimed.actionType, outcome: 'succeeded', durationMs: Date.now() - startedAt,
      })
      return { plan: completed, replayed: false }
    }
    catch (error) {
      const agentDetails = readAgentErrorDetails(error)
      if (agentDetails?.category === 'OPTIMISTIC_LOCK_CONFLICT') {
        await AiActionPlanRepository.markStale(event, claimed.id, user.id, normalizeAgentFailure(error))
      }
      else {
        await AiActionPlanRepository.fail(event, claimed.id, user.id, normalizeAgentFailure(error))
      }
      emitAiTelemetry(event, {
        event: 'ai.action', requestId: requestId(event), conversationId: claimed.conversationId,
        actionPlanId: claimed.id, actionType: claimed.actionType, outcome: 'failed',
        durationMs: Date.now() - startedAt,
        errorCategory: agentDetails?.category ?? 'INTERNAL_TOOL_FAILURE',
      })
      throw error
    }
  },

  async cancel(event: H3Event, user: AuthUser, planId: string): Promise<AiActionPlan> {
    const existing = await AiActionPlanRepository.findOwnedById(event, planId, user.id)
    if (!existing) throwNotFound('Không tìm thấy kế hoạch thao tác')
    if (existing.status === 'cancelled') return existing
    if (existing.status !== 'pending' || Date.parse(existing.expiresAt) <= Date.now()) conflictForPlan(existing)
    const cancelled = await AiActionPlanRepository.cancel(event, existing.id, user.id)
    if (!cancelled) {
      const current = await AiActionPlanRepository.findOwnedById(event, existing.id, user.id)
      if (!current) throwNotFound('Không tìm thấy kế hoạch thao tác')
      conflictForPlan(current)
    }
    return cancelled
  },
}
