import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  findProfile: vi.fn(),
  updateProfile: vi.fn(),
  findContract: vi.fn(),
  listInvoices: vi.fn(),
  findInvoiceDetail: vi.fn(),
}))

vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: mocks.resolveTenantId }))
vi.mock('../../../server/repositories/tenant-portal/profile', () => ({
  TenantProfileRepository: {
    findByTenantId: mocks.findProfile,
    updateByTenantId: mocks.updateProfile,
  },
}))
vi.mock('../../../server/repositories/tenant-portal/contract', () => ({
  TenantContractRepository: { findActiveByTenantId: mocks.findContract },
}))
vi.mock('../../../server/repositories/tenant-portal/invoices', () => ({
  TenantInvoiceRepository: {
    list: mocks.listInvoices,
    findDetail: mocks.findInvoiceDetail,
  },
}))

const tenantUser = { id: 'auth-tenant', app_metadata: { role: 'tenant' } } as never
const internalUser = { id: 'auth-admin', app_metadata: { role: 'admin' } } as never

describe('tenant portal services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.findProfile.mockResolvedValue({ id: 'tenant-1' })
    mocks.updateProfile.mockResolvedValue({ id: 'tenant-1', phone: '0902' })
    mocks.findContract.mockResolvedValue(null)
    mocks.listInvoices.mockResolvedValue({ items: [], total: 0 })
    mocks.findInvoiceDetail.mockResolvedValue(null)
  })

  it('always resolves self scope and cannot be redirected by an injected tenant id', async () => {
    const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')

    await (TenantProfileService.get as (...args: unknown[]) => Promise<unknown>)({} as never, tenantUser, 'tenant-2')
    await TenantProfileService.update({} as never, tenantUser, {
      phone: '0902', status: 'archived', tenant_id: 'tenant-2',
    } as never)

    expect(mocks.resolveTenantId).toHaveBeenCalledTimes(2)
    expect(mocks.findProfile).toHaveBeenCalledWith(expect.anything(), 'tenant-1')
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.anything(), 'tenant-1', { phone: '0902' })
  })

  it('rechecks tenant capabilities and rejects internal roles', async () => {
    const { TenantContractService } = await import('../../../server/services/tenant-portal/contract')
    await expect(TenantContractService.get({} as never, internalUser)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.resolveTenantId).not.toHaveBeenCalled()
  })

  it('returns the resolved tenant active contract summary', async () => {
    const contract = {
      id: 'contract-1',
      contractCode: 'C-001',
      roomNumber: 'A101',
      buildingName: 'Zeno One',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      monthlyRent: 5_000_000,
      deposit: 10_000_000,
      status: 'active',
    }
    mocks.findContract.mockResolvedValue(contract)
    const { TenantContractService } = await import('../../../server/services/tenant-portal/contract')

    const result = await TenantContractService.get({} as never, tenantUser, '2026-07-16')

    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), tenantUser)
    expect(mocks.findContract).toHaveBeenCalledWith(expect.anything(), 'tenant-1', '2026-07-16')
    expect(result).toEqual(contract)
  })

  it('derives overdue status and paginates only tenant invoices', async () => {
    mocks.listInvoices.mockResolvedValue({
      total: 1,
      items: [{
        id: 'invoice-1', invoice_code: 'INV-1', billing_period_id: 'period-1',
        period_year: 2026, period_month: 7, building_id: 'building-1', building_name: 'Zeno',
        room_id: 'room-1', room_number: 'A101', contract_id: 'contract-1', contract_code: 'C-1',
        tenant_id: 'tenant-1', tenant_name: 'Tenant', total_amount: 1000, paid_amount: 0,
        balance_amount: 1000, due_date: '2026-07-01', status: 'issued', issued_at: '2026-07-01T00:00:00Z',
      }],
    })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')

    const result = await TenantInvoiceService.list(
      {} as never,
      tenantUser,
      { page: 1, page_size: 20 },
      '2026-07-16',
    )

    expect(mocks.listInvoices).toHaveBeenCalledWith(expect.anything(), 'tenant-1', { page: 1, page_size: 20 }, '2026-07-16')
    expect(result.data[0]).toMatchObject({ id: 'invoice-1', status: 'overdue' })
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 })
  })

  it('uses the same not-found response for missing or cross-tenant invoice detail', async () => {
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')

    await expect(TenantInvoiceService.getDetail({} as never, tenantUser, 'invoice-other'))
      .rejects.toMatchObject({ statusCode: 404, data: { error: { code: 'NOT_FOUND' } } })
  })

  it('returns owned voided invoice detail with void metadata and charge lines', async () => {
    mocks.findInvoiceDetail.mockResolvedValue({
      invoice: {
        id: 'invoice-void',
        invoice_code: 'INV-VOID',
        billing_period_id: 'period-1',
        period_year: 2026,
        period_month: 7,
        building_id: 'building-1',
        building_name: 'Zeno One',
        building_slug: 'zeno-one',
        room_id: 'room-1',
        room_number: 'A101',
        contract_id: 'contract-1',
        contract_code: 'C-001',
        tenant_id: 'tenant-1',
        tenant_name: 'Tenant',
        total_amount: 5_000_000,
        paid_amount: 0,
        balance_amount: 0,
        due_date: '2026-07-10',
        status: 'void',
        issued_at: '2026-07-01T00:00:00.000Z',
        voided_at: '2026-07-05T00:00:00.000Z',
        void_reason: 'Issued in error',
        notes: null,
      },
      charges: [{
        id: 'charge-1',
        invoice_id: 'invoice-void',
        charge_type: 'rent',
        label: 'Rent',
        quantity: 1,
        unit_price: 5_000_000,
        amount: 5_000_000,
        sort_order: 0,
      }],
    })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')

    const result = await TenantInvoiceService.getDetail(
      {} as never,
      tenantUser,
      'invoice-void',
      '2026-07-16',
    )

    expect(result).toMatchObject({
      id: 'invoice-void',
      status: 'void',
      voidedAt: '2026-07-05T00:00:00.000Z',
      voidReason: 'Issued in error',
      charges: [{ id: 'charge-1', chargeType: 'rent', amount: 5_000_000 }],
    })
  })
})
