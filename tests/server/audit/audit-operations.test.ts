import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  begin: vi.fn(),
  complete: vi.fn(),
  claimStale: vi.fn(),
  markUnresolved: vi.fn(),
}))

vi.mock('../../../server/repositories/audit-operations', () => ({ AuditOperationRepository: repository }))
vi.mock('../../../server/utils/audit-telemetry', () => ({ reportAuditMetric: vi.fn() }))

describe('AuditOperationService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sanitizes durable intent and completion snapshots', async () => {
    repository.begin.mockResolvedValue({ id: 'operation-1' })
    const { AuditOperationService } = await import('../../../server/services/audit-operations')
    const operation = await AuditOperationService.begin({} as never, {
      idempotencyKey: 'key-1',
      actorId: 'actor-1',
      buildingId: null,
      action: 'tenant.updated',
      entityType: 'tenant',
      intentData: { side: 'front', privatePath: 'tenant/private.jpg', accessToken: 'secret' },
    })
    await AuditOperationService.complete({} as never, operation.id, {
      afterData: { name: 'An', idCardFrontPath: 'tenant/private.jpg' },
    })

    expect(repository.begin).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ intentData: { side: 'front' } }))
    expect(repository.complete).toHaveBeenCalledWith(expect.anything(), 'operation-1', expect.objectContaining({ afterData: { name: 'An' } }))
  })

  it('leases stale unknown outcomes and retains them as unresolved', async () => {
    repository.claimStale.mockResolvedValue([{ id: 'operation-1', action: 'tenant.updated', attemptCount: 2 }])
    const { AuditOperationService } = await import('../../../server/services/audit-operations')
    await expect(AuditOperationService.reconcile({} as never)).resolves.toEqual({ claimed: 1, unresolved: 1 })
    expect(repository.markUnresolved).toHaveBeenCalledWith(expect.anything(), 'operation-1', 'OUTCOME_REQUIRES_VERIFICATION')
  })
})
