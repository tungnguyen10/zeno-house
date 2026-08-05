import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  findPeriod: vi.fn(),
  findScopedContract: vi.fn(),
  listInvoices: vi.fn(),
  assertScope: vi.fn(),
  list: vi.fn(),
  findCharge: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/periods', () => ({ BillingPeriodRepository: { findById: mocks.findPeriod } }))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findByIdInBuilding: mocks.findScopedContract } }))
vi.mock('../../../server/repositories/billing/invoices', () => ({ InvoiceRepository: { listByPeriod: mocks.listInvoices } }))
vi.mock('../../../server/repositories/billing/incidental-charges', () => ({ BillingIncidentalChargeRepository: {
  listByPeriod: mocks.list,
  findById: mocks.findCharge,
  createWithAudit: mocks.create,
  updateWithAudit: mocks.update,
  deleteWithAudit: mocks.remove,
} }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.assertScope }))

const event = { context: {} } as never
const user = { id: '10000000-0000-4000-8000-000000000001', app_metadata: { role: 'manager' } } as AuthUser
const period = {
  id: '10000000-0000-4000-8000-000000000002',
  buildingId: '10000000-0000-4000-8000-000000000003',
  periodYear: 2026,
  periodMonth: 8,
  status: 'draft',
}
const contract = {
  id: '10000000-0000-4000-8000-000000000004',
  buildingId: period.buildingId,
  roomId: '10000000-0000-4000-8000-000000000005',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
}
const charge = {
  id: '10000000-0000-4000-8000-000000000006',
  billingPeriodId: period.id,
  contractId: contract.id,
  roomId: contract.roomId,
  label: 'Làm mất chìa khóa',
  amount: 150_000,
  note: null,
  operationId: '10000000-0000-4000-8000-000000000007',
  createdBy: user.id,
  createdAt: '2026-08-05T10:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
}

describe('BillingIncidentalChargeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findPeriod.mockResolvedValue(period)
    mocks.findScopedContract.mockResolvedValue(contract)
    mocks.listInvoices.mockResolvedValue([])
    mocks.list.mockResolvedValue([charge])
    mocks.findCharge.mockResolvedValue(charge)
    mocks.create.mockResolvedValue(charge)
    mocks.update.mockResolvedValue(charge)
    mocks.remove.mockResolvedValue(charge)
  })

  it('lists in-scope period charges with read permission', async () => {
    const { BillingIncidentalChargeService } = await import('../../../server/services/billing/incidental-charges')
    await expect(BillingIncidentalChargeService.list(event, user, period.id)).resolves.toEqual([charge])
    expect(mocks.assertScope).toHaveBeenCalledWith(event, user, period.buildingId, 'read')
  })

  it('creates through the atomic repository contract after ownership checks', async () => {
    const { BillingIncidentalChargeService } = await import('../../../server/services/billing/incidental-charges')
    const input = {
      contract_id: contract.id,
      label: charge.label,
      amount: charge.amount,
      note: null,
      operation_id: charge.operationId,
    }
    await expect(BillingIncidentalChargeService.create(event, user, period.id, input)).resolves.toEqual(charge)
    expect(mocks.assertScope).toHaveBeenCalledWith(event, user, period.buildingId, 'write')
    expect(mocks.findScopedContract).toHaveBeenCalledWith(event, contract.id, period.buildingId)
    expect(mocks.create).toHaveBeenCalledWith(event, period.id, user.id, input)
  })

  it.each([
    ['closed period', { period: { ...period, status: 'closed' } }],
    ['effective invoice', { invoices: [{ contractId: contract.id, status: 'issued' }] }],
    ['out-of-scope contract', { contract: null }],
    ['non-overlapping contract', { contract: { ...contract, startDate: '2026-09-01' } }],
  ])('blocks create for %s', async (_label, state) => {
    if (state.period) mocks.findPeriod.mockResolvedValue(state.period)
    if (state.invoices) mocks.listInvoices.mockResolvedValue(state.invoices)
    if ('contract' in state) mocks.findScopedContract.mockResolvedValue(state.contract)
    const { BillingIncidentalChargeService } = await import('../../../server/services/billing/incidental-charges')
    await expect(BillingIncidentalChargeService.create(event, user, period.id, {
      contract_id: contract.id, label: charge.label, amount: charge.amount, operation_id: charge.operationId,
    })).rejects.toMatchObject({ statusCode: expect.any(Number) })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('allows mutation when earlier invoices are void', async () => {
    mocks.listInvoices.mockResolvedValue([{ contractId: contract.id, status: 'void' }])
    const { BillingIncidentalChargeService } = await import('../../../server/services/billing/incidental-charges')
    await expect(BillingIncidentalChargeService.update(event, user, period.id, charge.id, {
      label: 'Cấp lại chìa khóa', expected_updated_at: charge.updatedAt,
    })).resolves.toEqual(charge)
    expect(mocks.update).toHaveBeenCalledWith(event, period.id, user.id, charge.id, {
      label: 'Cấp lại chìa khóa', amount: charge.amount, note: null, expected_updated_at: charge.updatedAt,
    })
  })

  it('deletes through the atomic repository and rejects an out-of-period row', async () => {
    const { BillingIncidentalChargeService } = await import('../../../server/services/billing/incidental-charges')
    await BillingIncidentalChargeService.remove(event, user, period.id, charge.id, {
      expected_updated_at: charge.updatedAt,
    })
    expect(mocks.remove).toHaveBeenCalledWith(event, period.id, user.id, charge.id, charge.updatedAt)

    mocks.findCharge.mockResolvedValue({ ...charge, billingPeriodId: 'other-period' })
    await expect(BillingIncidentalChargeService.remove(event, user, period.id, charge.id, {
      expected_updated_at: charge.updatedAt,
    })).rejects.toMatchObject({ statusCode: 404 })
  })
})
