import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TenantIdentityConflictLimitRepository } from '../../../server/repositories/tenants/identity-conflict-limit'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc }) }))
const event = {} as never

beforeEach(() => vi.clearAllMocks())

describe('tenant identity conflict limit repository', () => {
  it('maps the peek result and sends the configured policy', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 120 }], error: null })
    expect(await TenantIdentityConflictLimitRepository.peek(event, { subjectHash: 'hashed-user', limit: 10, windowSeconds: 900 }))
      .toEqual({ allowed: false, retryAfterSeconds: 120 })
    expect(rpc).toHaveBeenCalledWith('peek_tenant_identity_conflict_limit', { p_subject_hash: 'hashed-user', p_limit: 10, p_window_seconds: 900 })
  })

  it('records all import conflict units in one RPC', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await TenantIdentityConflictLimitRepository.record(event, { subjectHash: 'hashed-user', units: 3, windowSeconds: 900 })
    expect(rpc).toHaveBeenCalledWith('record_tenant_identity_conflicts', { p_subject_hash: 'hashed-user', p_units: 3, p_window_seconds: 900 })
  })

  it('fails closed on a missing peek row', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(TenantIdentityConflictLimitRepository.peek(event, { subjectHash: 'hash', limit: 10, windowSeconds: 900 }))
      .rejects.toMatchObject({ statusCode: 500 })
  })

  it.each(['peek', 'record'] as const)('fails closed on a %s RPC error', async (operation) => {
    rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })
    await expect(TenantIdentityConflictLimitRepository[operation](event, { subjectHash: 'hash', limit: 10, units: 1, windowSeconds: 900 }))
      .rejects.toMatchObject({ statusCode: 500 })
  })
})
