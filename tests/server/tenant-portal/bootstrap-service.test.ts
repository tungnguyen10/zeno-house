import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profileGet: vi.fn(),
  contractGet: vi.fn(),
  amendmentList: vi.fn(),
  invoiceList: vi.fn(),
  financialSummary: vi.fn(),
}))

vi.mock('../../../server/services/tenant-portal/profile', () => ({
  TenantProfileService: { get: mocks.profileGet },
}))
vi.mock('../../../server/services/tenant-portal/contract', () => ({
  TenantContractService: { get: mocks.contractGet, listAmendments: mocks.amendmentList },
}))
vi.mock('../../../server/services/tenant-portal/invoices', () => ({
  TenantInvoiceService: { list: mocks.invoiceList, getFinancialSummary: mocks.financialSummary },
}))

describe('TenantBootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profileGet.mockResolvedValue({ id: 'tenant-1' })
    mocks.contractGet.mockResolvedValue(null)
    mocks.amendmentList.mockResolvedValue([])
    mocks.invoiceList.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    })
    mocks.financialSummary.mockResolvedValue({
      outstandingAmount: 1200, outstandingCount: 21,
      overdueAmount: 200, overdueCount: 1, nextInvoice: { id: 'older-debt' },
    })
  })

  it('loads the portal sources with the default invoice window', async () => {
    const event = { context: {} } as never
    const user = { id: 'auth-tenant', app_metadata: { role: 'tenant' } } as never
    const { TenantBootstrapService } = await import('../../../server/services/tenant-portal/bootstrap')

    await expect(TenantBootstrapService.get(event, user, '2026-07-22')).resolves.toEqual({
      profile: { id: 'tenant-1' },
      contract: null,
      contractAmendments: [],
      invoices: [],
      invoiceMeta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      financialSummary: {
        outstandingAmount: 1200, outstandingCount: 21,
        overdueAmount: 200, overdueCount: 1, nextInvoice: { id: 'older-debt' },
      },
    })
    expect(mocks.profileGet).toHaveBeenCalledWith(event, user)
    expect(mocks.contractGet).toHaveBeenCalledWith(event, user, '2026-07-22')
    expect(mocks.amendmentList).toHaveBeenCalledWith(event, user, '2026-07-22')
    expect(mocks.financialSummary).toHaveBeenCalledWith(event, user, '2026-07-22')
    expect(mocks.invoiceList).toHaveBeenCalledWith(
      event,
      user,
      { page: 1, page_size: 20 },
      '2026-07-22',
    )
  })
})
