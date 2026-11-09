import type { H3Event } from 'h3'
import { db } from '../../utils/db'

export const TenantIdentityConflictLimitRepository = {
  async peek(
    event: H3Event,
    input: { subjectHash: string; limit: number; windowSeconds: number },
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const client = db(event)
    const { data, error } = await client.rpc('peek_tenant_identity_conflict_limit', {
      p_subject_hash: input.subjectHash,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    })
    if (error) throwDbError(error, 'tenants.identityConflictLimit.peek')
    const row = data?.[0]
    if (!row) throwInternal(new Error('Empty tenant identity conflict limit result'), 'tenants.identityConflictLimit.peek')
    return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds }
  },

  async record(event: H3Event, input: { subjectHash: string; units: number; windowSeconds: number }): Promise<void> {
    const client = db(event)
    const { error } = await client.rpc('record_tenant_identity_conflicts', {
      p_subject_hash: input.subjectHash,
      p_units: input.units,
      p_window_seconds: input.windowSeconds,
    })
    if (error) throwDbError(error, 'tenants.identityConflictLimit.record')
  },
}
