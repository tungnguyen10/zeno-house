import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { ContractPaymentService } from '../../../server/services/contract-payments'
import { buildContract } from '../../__fixtures__/billing/contract'

const mocks = vi.hoisted(() => ({
  contract: vi.fn(), scope: vi.fn(), can: vi.fn(), audit: vi.fn(),
  listByContract: vi.fn(), insert: vi.fn(), findById: vi.fn(), updateById: vi.fn(), deleteById: vi.fn(),
}))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findById: mocks.contract } }))
vi.mock('../../../server/repositories/contract-payments', () => ({ ContractPaymentRepository: mocks }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.scope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: mocks.audit } }))

const event = {} as never
const user = { id: 'actor-1' } as AuthUser
const contract = buildContract({ status: 'renewed' })
const payment = { id: 'payment-1', contractId: contract.id }
const input = { payment_type: 'deposit' as const, amount: 100, paid_at: '2026-11-05' }
const mutations = {
  create: () => ContractPaymentService.create(event, user, contract.contractCode, input),
  update: () => ContractPaymentService.update(event, user, contract.contractCode, payment.id, { amount: 200 }),
  remove: () => ContractPaymentService.remove(event, user, contract.contractCode, payment.id),
}

function expectNoPaymentAccess() {
  for (const method of [mocks.findById, mocks.insert, mocks.updateById, mocks.deleteById]) {
    expect(method).not.toHaveBeenCalled()
  }
  expect(mocks.audit).not.toHaveBeenCalled()
}

describe('renewed contract receipt lock', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('can', mocks.can.mockReturnValue(true))
    mocks.contract.mockResolvedValue(contract)
    mocks.findById.mockResolvedValue(payment)
    mocks.insert.mockResolvedValue(payment)
    mocks.updateById.mockResolvedValue(payment)
  })

  it.each(Object.entries(mutations))('rejects %s after scope and before payment access', async (_, mutate) => {
    await expect(mutate()).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { code: 'CONFLICT', message: 'Hợp đồng đã gia hạn, không thể thay đổi khoản thu' } },
    })
    expect(mocks.scope).toHaveBeenCalledWith(event, user, contract.buildingId, 'write')
    expectNoPaymentAccess()
  })

  it.each(Object.entries(mutations))('preserves scope denial before the %s lock', async (_, mutate) => {
    const denied = new Error('outside building scope')
    mocks.scope.mockRejectedValue(denied)
    await expect(mutate()).rejects.toBe(denied)
    expectNoPaymentAccess()
  })

  it.each(Object.entries(mutations))('preserves %s on an active contract', async (_, mutate) => {
    mocks.contract.mockResolvedValue({ ...contract, status: 'active' })
    await mutate()
    expect(mocks.audit).toHaveBeenCalledOnce()
  })

  it('keeps historical receipts readable by canonical ID', async () => {
    mocks.listByContract.mockResolvedValue([payment])
    await expect(ContractPaymentService.list(event, user, contract.contractCode)).resolves.toEqual([payment])
    expect(mocks.scope).toHaveBeenCalledWith(event, user, contract.buildingId, 'read')
    expect(mocks.listByContract).toHaveBeenCalledWith(event, contract.id)
  })
})
