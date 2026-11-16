import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => vi.fn())
const listCrossPeriod = vi.hoisted(() => vi.fn())
const findCrossPeriodById = vi.hoisted(() => vi.fn())

vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: async () => 'tenant-1' }))
vi.mock('../../../server/services/tenants/identity-conflict', () => ({ TenantIdentityConflictService: { assertAvailable: vi.fn() } }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: vi.fn() } }))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findActiveByTenantId: async () => null } }))
vi.mock('../../../server/services/tenant-portal/contract', () => ({ TenantContractService: { get: async () => null, listAmendments: async () => [] } }))
vi.mock('../../../server/services/tenant-portal/invoices', () => ({ TenantInvoiceService: { list: async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }) } }))

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
      emergency_contact_name: null, emergency_contact_phone: null, notes: 'Private staff fixture',
    }
    const mock = chain({ data: row, error: null })
    dbMock.mockReturnValue(mock.client)
    const { TenantProfileRepository } = await import('../../../server/repositories/tenant-portal/profile')

    await expect(TenantProfileRepository.findByTenantId({} as never, 'tenant-1')).resolves.toMatchObject({ id: 'tenant-1' })
    const updated = await TenantProfileRepository.updateByTenantId({} as never, 'tenant-1', { phone: '0902' })
    expect(updated).not.toHaveProperty('notes')
    const read = await TenantProfileRepository.findByTenantId({} as never, 'tenant-1')
    expect(read).not.toHaveProperty('notes')
    expect(mock.calls.filter(call => call.method === 'select').every(call => !String(call.args[0]).split(', ').includes('notes'))).toBe(true)

    expect(mock.calls.filter(call => call.method === 'eq')).toEqual([
      { method: 'eq', args: ['id', 'tenant-1'] },
      { method: 'eq', args: ['id', 'tenant-1'] },
      { method: 'eq', args: ['id', 'tenant-1'] },
    ])
    expect(mock.calls.find(call => call.method === 'update')?.args[0]).toEqual({ phone: '0902' })
  })

  it('keeps internal notes out of real GET, PATCH and bootstrap profile pipelines', async () => {
    const row = { id: 'tenant-1', code: 'FIXTURE', status: 'active', full_name: 'Fictional Person', phone: '0900000000', notes: 'Private staff fixture' }
    const mock = chain({ data: row, error: null })
    dbMock.mockReturnValue(mock.client)
    const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')
    const { TenantBootstrapService } = await import('../../../server/services/tenant-portal/bootstrap')
    const user = { id: 'auth-fixture', app_metadata: { role: 'tenant' } } as never
    const event = {} as never
    const read = await TenantProfileService.get(event, user)
    const updated = await TenantProfileService.update(event, user, { occupation: 'Fixture' })
    const bootstrap = await TenantBootstrapService.get(event, user, '2026-11-10')
    for (const profile of [read, updated, bootstrap.profile]) {
      expect(profile).not.toHaveProperty('notes')
      expect(JSON.stringify(profile)).not.toContain('Private staff fixture')
    }
    expect(mock.calls.find(call => call.method === 'update')?.args[0]).toEqual({ occupation: 'Fixture' })
    expect(row.notes).toBe('Private staff fixture')
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
