import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profileGet: vi.fn(),
  contractGet: vi.fn(),
  invoiceList: vi.fn(),
}))

vi.mock('../../../server/services/tenant-portal/profile', () => ({
  TenantProfileService: { get: mocks.profileGet },
}))
vi.mock('../../../server/services/tenant-portal/contract', () => ({
  TenantContractService: { get: mocks.contractGet },
}))
vi.mock('../../../server/services/tenant-portal/invoices', () => ({
  TenantInvoiceService: { list: mocks.invoiceList },
}))

describe('TenantBootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profileGet.mockResolvedValue({ id: 'tenant-1' })
    mocks.contractGet.mockResolvedValue(null)
    mocks.invoiceList.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    })
  })

  it('loads the portal sources with the default invoice window', async () => {
    const event = { context: {} } as never
    const user = { id: 'auth-tenant', app_metadata: { role: 'tenant' } } as never
    const { TenantBootstrapService } = await import('../../../server/services/tenant-portal/bootstrap')

    await expect(TenantBootstrapService.get(event, user, '2026-07-22')).resolves.toEqual({
      profile: { id: 'tenant-1' },
      contract: null,
      invoices: [],
      invoiceMeta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    })
    expect(mocks.profileGet).toHaveBeenCalledWith(event, user)
    expect(mocks.contractGet).toHaveBeenCalledWith(event, user, '2026-07-22')
    expect(mocks.invoiceList).toHaveBeenCalledWith(
      event,
      user,
      { page: 1, page_size: 20 },
      '2026-07-22',
    )
  })
})
