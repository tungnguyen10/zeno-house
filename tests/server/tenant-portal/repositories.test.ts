import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => vi.fn())
const listCrossPeriod = vi.hoisted(() => vi.fn())
const findCrossPeriodById = vi.hoisted(() => vi.fn())

vi.mock('../../../server/utils/db', () => ({ db: dbMock }))
vi.mock('../../../server/repositories/invoices', () => ({
  CrossPeriodInvoiceRepository: { listCrossPeriod, findCrossPeriodById },
}))

function chain(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const query = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') {
        return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      }
      return (...args: unknown[]) => {
        calls.push({ method: String(property), args })
        if (property === 'maybeSingle' || property === 'single') return Promise.resolve(result)
        return query
      }
    },
  }) as Record<string, (...args: unknown[]) => unknown>
  const client = { from: vi.fn(() => query) }
  return { calls, client }
}

describe('tenant portal repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads and updates a profile by the resolved tenant id only', async () => {
    const row = {
      id: 'tenant-1', code: 'T-001', full_name: 'Tenant', phone: '0901', email: null,
      emergency_contact_name: null, emergency_contact_phone: null, notes: null,
    }
    const mock = chain({ data: row, error: null })
    dbMock.mockReturnValue(mock.client)
    const { TenantProfileRepository } = await import('../../../server/repositories/tenant-portal/profile')

    await expect(TenantProfileRepository.findByTenantId({} as never, 'tenant-1')).resolves.toMatchObject({ id: 'tenant-1' })
    await TenantProfileRepository.updateByTenantId({} as never, 'tenant-1', { phone: '0902' })

    expect(mock.calls.filter(call => call.method === 'eq')).toEqual([
      { method: 'eq', args: ['id', 'tenant-1'] },
      { method: 'eq', args: ['id', 'tenant-1'] },
    ])
    expect(mock.calls.find(call => call.method === 'update')?.args[0]).toEqual({ phone: '0902' })
  })

  it('passes a server-derived tenant or contract scope to invoice list and detail shaping', async () => {
    listCrossPeriod.mockResolvedValue({ items: [], total: 0 })
    findCrossPeriodById.mockResolvedValue(null)
    const { TenantInvoiceRepository } = await import('../../../server/repositories/tenant-portal/invoices')

    await TenantInvoiceRepository.list({} as never, { contractId: 'contract-1' }, { page: 2, page_size: 10 }, '2026-07-16')
    await TenantInvoiceRepository.findDetail({} as never, { contractId: 'contract-1' }, 'invoice-1')

    expect(listCrossPeriod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 2, page_size: 10, today: '2026-07-16' }),
      { contractId: 'contract-1' },
      { exactCount: false },
    )
    expect(findCrossPeriodById).toHaveBeenCalledWith(expect.anything(), 'invoice-1', { contractId: 'contract-1' })
  })
})
