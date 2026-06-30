import type { AuditEntityType } from '~/utils/constants/audit'

export interface AuditEvent {
  id: string
  buildingId: string | null
  actorId: string | null
  action: string
  entityType: AuditEntityType
  entityId: string | null
  correlationId: string | null
  beforeData: unknown
  afterData: unknown
  metadata: Record<string, unknown>
  createdAt: string
}
