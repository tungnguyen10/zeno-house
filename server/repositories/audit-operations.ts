import type { H3Event } from 'h3'
import { db } from '../utils/db'

export interface AuditOperation {
  id: string
  idempotencyKey: string
  action: string
  entityType: string
  entityId: string | null
  status: 'pending' | 'executing' | 'completed' | 'unresolved'
  attemptCount: number
}

function mapOperation(row: Record<string, unknown>): AuditOperation {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotency_key),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: typeof row.entity_id === 'string' ? row.entity_id : null,
    status: row.status as AuditOperation['status'],
    attemptCount: Number(row.attempt_count ?? 0),
  }
}

export const AuditOperationRepository = {
  async begin(event: H3Event, input: {
    idempotencyKey: string
    actorId: string | null
    buildingId: string | null
    action: string
    entityType: string
    entityId?: string | null
    intentData?: Record<string, unknown>
  }): Promise<AuditOperation> {
    const client = db(event)
    const { error } = await client
      .from('audit_operations' as never)
      .upsert({
        idempotency_key: input.idempotencyKey,
        actor_id: input.actorId,
        building_id: input.buildingId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        intent_data: input.intentData ?? {},
      } as never, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    if (error) throwDbError(error, 'auditOperations.begin')
    const { data, error: readError } = await client
      .from('audit_operations' as never)
      .select('*')
      .eq('idempotency_key', input.idempotencyKey)
      .single()
    if (readError) throwDbError(readError, 'auditOperations.begin.read')
    return mapOperation(data as unknown as Record<string, unknown>)
  },

  async complete(event: H3Event, operationId: string, input: {
    outcomeData?: Record<string, unknown>
    beforeData?: unknown
    afterData?: unknown
    metadata?: Record<string, unknown>
  }): Promise<void> {
    const { error } = await db(event).rpc('complete_audit_operation' as never, {
      p_operation_id: operationId,
      p_outcome_data: input.outcomeData ?? {},
      p_before_data: input.beforeData ?? null,
      p_after_data: input.afterData ?? null,
      p_metadata: input.metadata ?? {},
    } as never)
    if (error) throwDbError(error, 'auditOperations.complete')
  },

  async claimStale(event: H3Event, workerId: string, limit = 20): Promise<AuditOperation[]> {
    const { data, error } = await db(event).rpc('claim_stale_audit_operations' as never, {
      p_worker_id: workerId,
      p_limit: limit,
      p_lease_seconds: 60,
    } as never)
    if (error) throwDbError(error, 'auditOperations.claimStale')
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapOperation)
  },

  async markUnresolved(event: H3Event, operationId: string, errorCode: string): Promise<void> {
    const { error } = await db(event)
      .from('audit_operations' as never)
      .update({ status: 'unresolved', last_error_code: errorCode, lease_owner: null, lease_until: null } as never)
      .eq('id', operationId)
    if (error) throwDbError(error, 'auditOperations.markUnresolved')
  },
}
