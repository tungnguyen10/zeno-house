import { ContractRenewalRepository } from '../../../server/repositories/contract-renewals'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapContractRenewal } from '../../../app/utils/mappers/contract-renewals'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc: mocks.rpc }) }))

const event = {} as never
const args = { contractId: 'contract', mode: 'extend' as const, newEndDate: '2028-01-01', newMonthlyRent: null, reason: null, actorId: 'actor', operationId: 'operation', correlationId: 'correlation' }
const row = { id: 'renewal', contract_id: 'contract', new_contract_id: null, mode: 'extend', old_end_date: '2027-01-01', new_end_date: '2028-01-01', old_monthly_rent: 100, new_monthly_rent: 100, reason: null, created_by: 'actor', created_at: '2026-11-05T00:00:00Z' }

describe('atomic renewal repository', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each([false, true])('maps RPC payload and replay=%s to DTO', async (replayed) => {
    mocks.rpc.mockResolvedValue({ data: { renewal: row, new_contract: { id: 'successor' }, transferred_source_ids: ['source'], replayed }, error: null })
    await expect(ContractRenewalRepository.renewAtomic(event, args)).resolves.toEqual({ renewal: mapContractRenewal(row), newContractId: 'successor', transferredSourceIds: ['source'], replayed })
    expect(mocks.rpc).toHaveBeenCalledWith('renew_contract_atomic', {
      p_contract_id: 'contract', p_mode: 'extend', p_new_end_date: '2028-01-01', p_new_monthly_rent: null, p_reason: null, p_actor_id: 'actor', p_operation_id: 'operation', p_correlation_id: 'correlation',
    })
  })
  it('returns null for extension without successor', async () => {
    mocks.rpc.mockResolvedValue({ data: { renewal: row, new_contract: null, transferred_source_ids: [], replayed: false }, error: null })
    await expect(ContractRenewalRepository.renewAtomic(event, args)).resolves.toMatchObject({ newContractId: null })
  })
  it('routes database failures through the shared error mapper', async () => {
    const error = { message: 'CONTRACT_NOT_ACTIVE' }
    const mapped = new Error('mapped error')
    const mapper = vi.fn(() => { throw mapped })
    vi.stubGlobal('throwDbError', mapper)
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(ContractRenewalRepository.renewAtomic(event, args)).rejects.toBe(mapped)
    expect(mapper).toHaveBeenCalledWith(error, 'contractRenewals.renewAtomic')
  })
})
