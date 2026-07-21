import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  contractFind: vi.fn(),
  findActiveByTenant: vi.fn(),
  occupantFindActiveOccupancy: vi.fn(),
  occupantFindActive: vi.fn(),
  occupantList: vi.fn(),
  occupantFind: vi.fn(),
  occupantInsert: vi.fn(),
  occupantUpdate: vi.fn(),
  occupantDelete: vi.fn(),
  paymentFind: vi.fn(),
  paymentInsert: vi.fn(),
  paymentUpdate: vi.fn(),
  paymentDelete: vi.fn(),
  auditAppend: vi.fn(),
}))

vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: {
  findById: mocks.contractFind, findActiveByTenantId: mocks.findActiveByTenant,
} }))
vi.mock('../../../server/repositories/contract-occupants', () => ({ ContractOccupantRepository: {
  findActiveOccupancyByTenant: mocks.occupantFindActiveOccupancy,
  findActiveByTenant: mocks.occupantFindActive,
  listByContract: mocks.occupantList,
  findById: mocks.occupantFind,
  insert: mocks.occupantInsert,
  updateById: mocks.occupantUpdate,
  deleteById: mocks.occupantDelete,
} }))
vi.mock('../../../server/repositories/contract-payments', () => ({ ContractPaymentRepository: {
  findById: mocks.paymentFind,
  insert: mocks.paymentInsert,
  updateById: mocks.paymentUpdate,
  deleteById: mocks.paymentDelete,
} }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: mocks.auditAppend } }))

const actor = { id: 'admin-1', app_metadata: { role: 'admin' } } as never
const event = { context: {} } as never

describe('contract related audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.contractFind.mockResolvedValue({ id: 'contract-1', tenantId: 'tenant-1', buildingId: 'building-1', occupantCount: 3 })
    mocks.findActiveByTenant.mockResolvedValue(null)
    mocks.occupantFindActiveOccupancy.mockResolvedValue(null)
    mocks.occupantFindActive.mockResolvedValue(null)
    mocks.occupantList.mockResolvedValue([])
  })

  it('audits occupant add, move-out and remove snapshots', async () => {
    const occupant = { id: 'occupant-1', contractId: 'contract-1', tenantId: 'tenant-2', role: 'roommate', moveOutDate: null }
    const moved = { ...occupant, moveOutDate: '2026-07-21' }
    mocks.occupantInsert.mockResolvedValue(occupant)
    mocks.occupantFind.mockResolvedValue(occupant)
    mocks.occupantUpdate.mockResolvedValue(moved)
    const { ContractOccupantService } = await import('../../../server/services/contract-occupants')

    await ContractOccupantService.add(event, actor, 'contract-1', { tenant_id: 'tenant-2', role: 'roommate' } as never)
    await ContractOccupantService.moveOut(event, actor, 'contract-1', 'occupant-1', { move_out_date: '2026-07-21' } as never)
    await ContractOccupantService.remove(event, actor, 'contract-1', 'occupant-1')

    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ action: 'contract_occupant.added', after_data: occupant }))
    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ action: 'contract_occupant.moved_out', before_data: occupant, after_data: moved }))
    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ action: 'contract_occupant.removed', before_data: occupant }))
  })

  it('audits payment create, update and remove snapshots', async () => {
    const payment = { id: 'payment-1', contractId: 'contract-1', amount: 100 }
    const updated = { ...payment, amount: 125 }
    mocks.paymentInsert.mockResolvedValue(payment)
    mocks.paymentFind.mockResolvedValue(payment)
    mocks.paymentUpdate.mockResolvedValue(updated)
    const { ContractPaymentService } = await import('../../../server/services/contract-payments')

    await ContractPaymentService.create(event, actor, 'contract-1', { amount: 100 } as never)
    await ContractPaymentService.update(event, actor, 'contract-1', 'payment-1', { amount: 125 } as never)
    await ContractPaymentService.remove(event, actor, 'contract-1', 'payment-1')

    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ action: 'contract_payment.created', after_data: payment }))
    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ action: 'contract_payment.updated', before_data: payment, after_data: updated }))
    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ action: 'contract_payment.removed', before_data: payment }))
  })
})
