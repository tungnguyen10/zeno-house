import type { H3Event } from 'h3'
import type { AiActionPlan } from '~/types/ai'
import type { Json } from '~/types/database.types'
import { mapAiActionPlan, type AiActionPlanRow } from '~/utils/mappers/ai'
import { db } from '../../utils/db'

function firstPlan(data: AiActionPlanRow[] | null): AiActionPlan | null {
  return data?.[0] ? mapAiActionPlan(data[0]) : null
}

export const AiActionPlanRepository = {
  async create(event: H3Event, input: {
    conversationId: string
    userId: string
    buildingId: string | null
    actionType: string
    title: string
    summary: string
    normalizedPayload: Record<string, unknown>
    payloadHash: string
    preview: Record<string, unknown>
    warnings: string[]
    resourceVersions: Record<string, string>
    expiresAt: string
  }): Promise<AiActionPlan> {
    const { data, error } = await db(event).from('ai_action_plans')
      .insert({
        conversation_id: input.conversationId,
        user_id: input.userId,
        building_id: input.buildingId,
        action_type: input.actionType,
        title: input.title,
        summary: input.summary,
        normalized_payload: input.normalizedPayload as Json,
        payload_hash: input.payloadHash,
        preview: input.preview as Json,
        warnings: input.warnings as Json,
        resource_versions: input.resourceVersions as Json,
        expires_at: input.expiresAt,
      })
      .select()
      .single()
    if (error) throwDbError(error, 'ai.actions.create')
    return mapAiActionPlan(data)
  },

  async findOwnedById(event: H3Event, id: string, userId: string): Promise<AiActionPlan | null> {
    const { data, error } = await db(event).from('ai_action_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throwDbError(error, 'ai.actions.findOwnedById')
    return data ? mapAiActionPlan(data) : null
  },

  async listByConversation(event: H3Event, conversationId: string, userId: string): Promise<AiActionPlan[]> {
    const { data, error } = await db(event).from('ai_action_plans')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    if (error) throwDbError(error, 'ai.actions.listByConversation')
    return (data ?? []).map(mapAiActionPlan)
  },

  async claim(event: H3Event, id: string, userId: string): Promise<AiActionPlan | null> {
    const { data, error } = await db(event).rpc('claim_ai_action_plan', { p_plan_id: id, p_user_id: userId })
    if (error) throwDbError(error, 'ai.actions.claim')
    return firstPlan(data)
  },

  async cancel(event: H3Event, id: string, userId: string): Promise<AiActionPlan | null> {
    const { data, error } = await db(event).rpc('cancel_ai_action_plan', { p_plan_id: id, p_user_id: userId })
    if (error) throwDbError(error, 'ai.actions.cancel')
    return firstPlan(data)
  },

  async complete(event: H3Event, id: string, userId: string, result: unknown): Promise<AiActionPlan | null> {
    const { data, error } = await db(event).rpc('complete_ai_action_plan', {
      p_plan_id: id,
      p_user_id: userId,
      p_result: (result ?? {}) as Json,
    })
    if (error) throwDbError(error, 'ai.actions.complete')
    return firstPlan(data)
  },

  async fail(event: H3Event, id: string, userId: string, errorValue: unknown): Promise<AiActionPlan | null> {
    const { data, error } = await db(event).rpc('fail_ai_action_plan', {
      p_plan_id: id,
      p_user_id: userId,
      p_error: (errorValue ?? {}) as Json,
    })
    if (error) throwDbError(error, 'ai.actions.fail')
    return firstPlan(data)
  },

  async markStale(event: H3Event, id: string, userId: string, errorValue: unknown): Promise<AiActionPlan | null> {
    const { data, error } = await db(event).rpc('mark_ai_action_plan_stale', {
      p_plan_id: id,
      p_user_id: userId,
      p_error: (errorValue ?? {}) as Json,
    })
    if (error) throwDbError(error, 'ai.actions.markStale')
    return firstPlan(data)
  },
}
