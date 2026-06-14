import { vi } from 'vitest'

const serverSupabaseClient = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseClient,
}))

interface TenantRow {
  id: string
  full_name: string
  phone: string
  email: string | null
  id_number: string | null
  date_of_birth: string | null
  gender: string | null
  occupation: string | null
  id_issued_date: string | null
  id_issued_place: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  permanent_address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface ContractRow {
  id: string
  building_id: string
  tenant_id: string
  status?: string
  room_id?: string
}

interface ContractOccupantRow {
  contract_id: string
  tenant_id: string
}

function buildTenant(overrides: Partial<TenantRow>): TenantRow {
  return {
    id: 'tenant-1',
    full_name: 'Tenant',
    phone: '0900000000',
    email: null,
    id_number: null,
    date_of_birth: null,
    gender: null,
    occupation: null,
    id_issued_date: null,
    id_issued_place: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    permanent_address: null,
    notes: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function createClientMock(input: {
  tenants: TenantRow[]
  contracts: ContractRow[]
  occupants: ContractOccupantRow[]
}) {
  class QueryBuilder {
    private equals = new Map<string, string>()
    private inValues = new Map<string, string[]>()
    private search: string | null = null
    private rangeFrom = 0
    private rangeTo = Number.POSITIVE_INFINITY

    constructor(private readonly table: string) {}

    select() {
      return this
    }

    order() {
      return this
    }

    range(from: number, to: number) {
      this.rangeFrom = from
      this.rangeTo = to
      return this
    }

    eq(column: string, value: string) {
      this.equals.set(column, value)
      return this
    }

    is() {
      return this
    }

    in(column: string, values: string[]) {
      this.inValues.set(column, values)
      return this
    }

    or(expression: string) {
      const match = expression.match(/%([^%]+)%/)
      this.search = match?.[1]?.toLowerCase() ?? null
      return this
    }

    not() {
      return this
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
    }

    private execute() {
      if (this.table === 'contracts') {
        let rows = [...input.contracts]
        const buildingId = this.equals.get('building_id')
        if (buildingId) rows = rows.filter(row => row.building_id === buildingId)
        const status = this.equals.get('status')
        if (status) rows = rows.filter(row => row.status === status)
        return { data: rows, error: null, count: rows.length }
      }

      if (this.table === 'contract_occupants') {
        let rows = [...input.occupants]
        const contractIds = this.inValues.get('contract_id')
        if (contractIds) rows = rows.filter(row => contractIds.includes(row.contract_id))
        return { data: rows, error: null, count: rows.length }
      }

      let rows = [...input.tenants]
      const tenantIds = this.inValues.get('id')
      if (tenantIds) rows = rows.filter(row => tenantIds.includes(row.id))
      if (this.search) {
        rows = rows.filter(row =>
          row.full_name.toLowerCase().includes(this.search!)
          || row.phone.toLowerCase().includes(this.search!),
        )
      }

      rows.sort((a, b) => a.full_name.localeCompare(b.full_name))
      const count = rows.length
      rows = rows.slice(this.rangeFrom, this.rangeTo + 1)
      return { data: rows, error: null, count }
    }
  }

  return {
    from: (table: string) => new QueryBuilder(table),
  }
}

describe('TenantRepository.findAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters building tenants from primary contracts and contract occupants', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'primary-1', full_name: 'Binh Nguyen', phone: '0901000001' }),
        buildTenant({ id: 'occupant-1', full_name: 'An Tran', phone: '0901000002' }),
        buildTenant({ id: 'other-1', full_name: 'Cuong Le', phone: '0901000003' }),
      ],
      contracts: [
        { id: 'contract-1', building_id: 'building-1', tenant_id: 'primary-1', status: 'active', room_id: 'room-1' },
        { id: 'contract-2', building_id: 'building-2', tenant_id: 'other-1', status: 'active', room_id: 'room-2' },
      ],
      occupants: [
        { contract_id: 'contract-1', tenant_id: 'occupant-1' },
        { contract_id: 'contract-2', tenant_id: 'other-1' },
      ],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, { building_id: 'building-1' })

    expect(result.total).toBe(2)
    expect(result.items.map(tenant => tenant.id)).toEqual(['occupant-1', 'primary-1'])
  })

  it('combines building filter with search', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'primary-1', full_name: 'Binh Nguyen', phone: '0901000001' }),
        buildTenant({ id: 'occupant-1', full_name: 'An Tran', phone: '0912000002' }),
      ],
      contracts: [
        { id: 'contract-1', building_id: 'building-1', tenant_id: 'primary-1', status: 'active', room_id: 'room-1' },
      ],
      occupants: [
        { contract_id: 'contract-1', tenant_id: 'occupant-1' },
      ],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, { building_id: 'building-1', q: '0901' })

    expect(result.total).toBe(1)
    expect(result.items[0]?.id).toBe('primary-1')
  })
})
