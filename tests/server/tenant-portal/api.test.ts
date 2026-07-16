import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveTenantId: vi.fn(),
  profileGet: vi.fn(),
  profileUpdate: vi.fn(),
  contractGet: vi.fn(),
  invoiceList: vi.fn(),
  invoiceDetail: vi.fn(),
}))

vi.mock('../../../server/services/tenant-portal/profile', () => ({
  TenantProfileService: { get: mocks.profileGet, update: mocks.profileUpdate },
}))
vi.mock('../../../server/services/tenant-portal/contract', () => ({
  TenantContractService: { get: mocks.contractGet },
}))
vi.mock('../../../server/services/tenant-portal/invoices', () => ({
  TenantInvoiceService: { list: mocks.invoiceList, getDetail: mocks.invoiceDetail },
}))

type MockEvent = { context: { body?: unknown; query?: Record<string, unknown>; params?: Record<string, string> } }
const user = { id: 'auth-tenant', app_metadata: { role: 'tenant' } }

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('resolveTenantId', mocks.resolveTenantId)
vi.stubGlobal('parseBody', async (event: MockEvent, schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown } }) => {
  const result = schema.safeParse(event.context.body)
  if (!result.success) throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR' } } }
  return result.data
})
vi.stubGlobal('parseQuery', (event: MockEvent, schema: { parse: (value: unknown) => unknown }) => schema.parse(event.context.query ?? {}))
vi.stubGlobal('getRouterParam', (event: MockEvent, key: string) => event.context.params?.[key])

function event(input: MockEvent['context'] = {}): MockEvent {
  return { context: input }
}

describe('tenant portal API handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(user)
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.profileGet.mockResolvedValue({ id: 'tenant-1' })
    mocks.profileUpdate.mockResolvedValue({ id: 'tenant-1', phone: '0902' })
    mocks.contractGet.mockResolvedValue(null)
    mocks.invoiceList.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })
    mocks.invoiceDetail.mockResolvedValue({ id: 'invoice-1', charges: [] })
  })

  it('requires auth and resolves tenant scope in every handler', async () => {
    const handlers = [
      (await import('../../../server/api/tenant/me.get')).default,
      (await import('../../../server/api/tenant/me.patch')).default,
      (await import('../../../server/api/tenant/contract.get')).default,
      (await import('../../../server/api/tenant/invoices/index.get')).default,
      (await import('../../../server/api/tenant/invoices/[id].get')).default,
    ]
    const events = [
      event(),
      event({ body: { phone: '0902' } }),
      event(),
      event({ query: {} }),
      event({ params: { id: 'invoice-1' } }),
    ]

    for (const [index, handler] of handlers.entries()) await handler(events[index] as never)

    expect(mocks.requireAuth).toHaveBeenCalledTimes(5)
    expect(mocks.resolveTenantId).toHaveBeenCalledTimes(5)
  })

  it('ignores client tenant identifiers in profile updates and invoice queries', async () => {
    const { default: patchProfile } = await import('../../../server/api/tenant/me.patch')
    const { default: listInvoices } = await import('../../../server/api/tenant/invoices/index.get')

    await patchProfile(event({ body: { phone: '0902', tenant_id: 'tenant-2', status: 'archived' } }) as never)
    await listInvoices(event({ query: { page: '1', page_size: '10', tenant_id: 'tenant-2' } }) as never)

    expect(mocks.profileUpdate).toHaveBeenCalledWith(expect.anything(), user, { phone: '0902' })
    expect(mocks.invoiceList).toHaveBeenCalledWith(expect.anything(), user, { page: 1, page_size: 10 })
  })

  it('rejects a profile patch containing only forbidden fields', async () => {
    const { default: patchProfile } = await import('../../../server/api/tenant/me.patch')

    await expect(patchProfile(event({ body: { tenant_id: 'tenant-2', status: 'archived' } }) as never))
      .rejects.toMatchObject({ statusCode: 422, data: { error: { code: 'VALIDATION_ERROR' } } })
    expect(mocks.profileUpdate).not.toHaveBeenCalled()
  })

  it('returns standard data envelopes', async () => {
    const { default: getProfile } = await import('../../../server/api/tenant/me.get')
    const { default: getContract } = await import('../../../server/api/tenant/contract.get')
    const { default: getInvoice } = await import('../../../server/api/tenant/invoices/[id].get')

    await expect(getProfile(event() as never)).resolves.toEqual({ data: { id: 'tenant-1' } })
    await expect(getContract(event() as never)).resolves.toEqual({ data: null })
    await expect(getInvoice(event({ params: { id: 'invoice-1' } }) as never)).resolves.toEqual({ data: { id: 'invoice-1', charges: [] } })
  })
})
