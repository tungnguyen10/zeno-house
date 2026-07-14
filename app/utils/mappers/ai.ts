import type {
  AiActionPlan,
  AiActionPlanDto,
  AiActionPlanStatus,
  AiConversation,
  AiConversationStatus,
  AiMessage,
  AiMessageRole,
} from '~/types/ai'
import type { Database } from '~/types/database.types'

export type AiConversationRow = Database['public']['Tables']['ai_conversations']['Row']
export type AiMessageRow = Database['public']['Tables']['ai_messages']['Row']
export type AiActionPlanRow = Database['public']['Tables']['ai_action_plans']['Row']

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

export function mapAiConversation(row: AiConversationRow): AiConversation {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status as AiConversationStatus,
    title: row.title,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapAiMessage(row: AiMessageRow): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role as AiMessageRole,
    content: row.content,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
  }
}

export function mapAiActionPlan(row: AiActionPlanRow): AiActionPlan {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    buildingId: row.building_id,
    actionType: row.action_type,
    title: row.title,
    summary: row.summary,
    normalizedPayload: asRecord(row.normalized_payload),
    payloadHash: row.payload_hash,
    preview: asRecord(row.preview),
    warnings: Array.isArray(row.warnings) ? row.warnings.filter((v): v is string => typeof v === 'string') : [],
    resourceVersions: asStringRecord(row.resource_versions),
    idempotencyKey: row.idempotency_key,
    status: row.status as AiActionPlanStatus,
    result: row.result,
    error: row.error,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
    executedAt: row.executed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toAiActionPlanDto(plan: AiActionPlan): AiActionPlanDto {
  return {
    id: plan.id,
    conversationId: plan.conversationId,
    actionType: plan.actionType,
    status: plan.status,
    title: plan.title,
    summary: plan.summary,
    buildingId: plan.buildingId,
    preview: plan.preview,
    warnings: plan.warnings,
    expiresAt: plan.expiresAt,
    ...(plan.result !== null && { result: plan.result }),
    ...(plan.error !== null && { error: plan.error }),
  }
}
