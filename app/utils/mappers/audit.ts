import type { Tables } from '~/types/database.types'
import type { AuditEvent } from '~/types/audit'
import type { AuditEntityType } from '~/utils/constants/audit'

function asMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function mapAuditEvent(row: Tables<'audit_events'>): AuditEvent {
  const hardened = row as Tables<'audit_events'> & {
    operation_id?: string | null
    building_name_snapshot?: string | null
    building_code_snapshot?: string | null
  }
  return {
    id: row.id,
    buildingId: row.building_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id,
    correlationId: row.correlation_id,
    operationId: hardened.operation_id ?? null,
    buildingNameSnapshot: hardened.building_name_snapshot ?? null,
    buildingCodeSnapshot: hardened.building_code_snapshot ?? null,
    beforeData: row.before_data,
    afterData: row.after_data,
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at,
  }
}
