import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => vi.fn())

vi.mock('../../../server/utils/db', () => ({ db: dbMock }))

function chain(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const query = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') {
        return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      }
      return (...args: unknown[]) => {
        calls.push({ method: String(property), args })
        if (property === 'maybeSingle') return Promise.resolve(result)
        return query
      }
    },
  }) as Record<string, (...args: unknown[]) => unknown>
  return { calls, client: { from: vi.fn(() => query) } }
}

describe('TenantHousingRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prefers the tenant primary contract without querying occupancy', async () => {
    const primary = chain({
      data: {
        id: 'contract-primary', tenant_id: 'tenant-1', building_id: 'building-1',
        contract_code: 'C-1', start_date: '2026-01-01', end_date: '2026-12-31',
        monthly_rent: 5_000_000, deposit: 10_000_000, status: 'active',
        tenants: { full_name: 'Nguyễn Văn A' },
        rooms: { room_number: 'A101', buildings: { name: 'Zeno One' } },
      },
      error: null,
    })
    dbMock.mockReturnValue(primary.client)
    const { TenantHousingRepository } = await import('../../../server/repositories/tenant-portal/housing')

    const result = await TenantHousingRepository.resolveActive({} as never, 'tenant-1', '2026-07-22')

    expect(primary.client.from).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      contractId: 'contract-primary', buildingId: 'building-1', primaryTenantId: 'tenant-1',
      assignmentRole: 'primary', primaryTenantName: 'Nguyễn Văn A',
      contract: { id: 'contract-primary', assignmentRole: 'primary', primaryTenantName: 'Nguyễn Văn A' },
    })
  })

  it('falls back to an active, moved-in roommate occupancy', async () => {
    const primary = chain({ data: null, error: null })
    const roommate = chain({
      data: {
        contracts: {
          id: 'contract-shared', tenant_id: 'tenant-primary', building_id: 'building-1',
          contract_code: 'C-2', start_date: '2026-01-01', end_date: '2026-12-31',
          monthly_rent: 6_000_000, deposit: 12_000_000, status: 'active',
          tenants: { full_name: 'Trần Thị Chính' },
          rooms: { room_number: 'A102', buildings: { name: 'Zeno One' } },
        },
      },
      error: null,
    })
    dbMock.mockReturnValueOnce(primary.client).mockReturnValueOnce(roommate.client)
    const { TenantHousingRepository } = await import('../../../server/repositories/tenant-portal/housing')

    const result = await TenantHousingRepository.resolveActive({} as never, 'tenant-roommate', '2026-07-22')

    expect(roommate.client.from).toHaveBeenCalledWith('contract_occupants')
    expect(roommate.calls).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['tenant_id', 'tenant-roommate'] },
      { method: 'lte', args: ['move_in_date', '2026-07-22'] },
      { method: 'is', args: ['move_out_date', null] },
      { method: 'eq', args: ['contracts.status', 'active'] },
      { method: 'lte', args: ['contracts.start_date', '2026-07-22'] },
      { method: 'gte', args: ['contracts.end_date', '2026-07-22'] },
    ]))
    expect(result).toMatchObject({
      contractId: 'contract-shared', primaryTenantId: 'tenant-primary',
      assignmentRole: 'roommate', primaryTenantName: 'Trần Thị Chính',
      contract: { assignmentRole: 'roommate', primaryTenantName: 'Trần Thị Chính' },
    })
  })

  it('returns no shared context when neither primary contract nor active occupancy exists', async () => {
    const primary = chain({ data: null, error: null })
    const roommate = chain({ data: null, error: null })
    dbMock.mockReturnValueOnce(primary.client).mockReturnValueOnce(roommate.client)
    const { TenantHousingRepository } = await import('../../../server/repositories/tenant-portal/housing')

    await expect(TenantHousingRepository.resolveActive({} as never, 'tenant-1', '2026-07-22'))
      .resolves.toBeNull()
  })
})
