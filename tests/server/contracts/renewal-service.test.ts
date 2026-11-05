import { ContractRenewalService } from '../../../server/services/contract-renewals'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { buildContract } from '../../__fixtures__/billing/contract'

const mocks = vi.hoisted(() => ({ findById: vi.fn(), renewAtomic: vi.fn(), scope: vi.fn(), can: vi.fn() }))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findById: mocks.findById } }))
vi.mock('../../../server/repositories/contract-renewals', () => ({ ContractRenewalRepository: { renewAtomic: mocks.renewAtomic } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.scope }))

const event = { context: {} } as never
const user = { id: 'actor-1' } as AuthUser
const contract = buildContract()
const renewal = { id: 'renewal-1' }
const input = { mode: 'extend' as const, new_end_date: '2028-01-01' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('atomic contract renewal service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('can', mocks.can.mockReturnValue(true))
    mocks.findById.mockResolvedValue(contract)
    mocks.renewAtomic.mockResolvedValue({ renewal })
  })

  it('requires update permission before reading or renewing', async () => {
    mocks.can.mockReturnValue(false)
    await expect(ContractRenewalService.renew(event, user, 'code', input)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.can).toHaveBeenCalledWith(user, 'contracts.update')
    expect(mocks.findById).not.toHaveBeenCalled()
    expect(mocks.renewAtomic).not.toHaveBeenCalled()
  })

  it('requires write scope before renewing', async () => {
    mocks.scope.mockRejectedValue(new Error('scope denied'))
    await expect(ContractRenewalService.renew(event, user, 'code', input)).rejects.toThrow('scope denied')
    expect(mocks.scope).toHaveBeenCalledWith(event, user, contract.buildingId, 'write')
    expect(mocks.renewAtomic).not.toHaveBeenCalled()
  })

  it('returns not found without renewing', async () => {
    mocks.findById.mockResolvedValue(null)
    await expect(ContractRenewalService.renew(event, user, 'missing', input)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.renewAtomic).not.toHaveBeenCalled()
  })

  it.each(['extend', 'new_contract'] as const)('passes canonical ID and idempotency for %s', async (mode) => {
    const operationId = randomUUID()
    const result = await ContractRenewalService.renew(event, user, 'code', { ...input, mode, new_monthly_rent: 4000000, operation_id: operationId })
    expect(result).toEqual(renewal)
    expect(mocks.renewAtomic).toHaveBeenCalledWith(event, {
      contractId: contract.id, mode, newEndDate: input.new_end_date, newMonthlyRent: 4000000,
      reason: null, actorId: user.id, operationId, correlationId: expect.stringMatching(uuid),
    })
  })

  it('generates an operation ID and passes omitted rent as null', async () => {
    await ContractRenewalService.renew(event, user, 'code', input)
    expect(mocks.renewAtomic).toHaveBeenCalledWith(event, expect.objectContaining({
      operationId: expect.stringMatching(uuid), correlationId: expect.stringMatching(uuid), newMonthlyRent: null,
    }))
  })

  it('allows the RPC to replay a renewal after contract status and date changed', async () => {
    mocks.findById.mockResolvedValue({ ...contract, status: 'renewed', endDate: input.new_end_date })
    await expect(ContractRenewalService.renew(event, user, 'code', input)).resolves.toEqual(renewal)
    expect(mocks.renewAtomic).toHaveBeenCalledOnce()
  })
})
