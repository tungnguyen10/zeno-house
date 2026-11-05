import { vi } from 'vitest'

const serverSupabaseClient = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseClient,
  serverSupabaseServiceRole: serverSupabaseClient,
}))

interface TenantRow {
  id: string
  code?: string | null
  full_name: string
  phone: string
  email: string | null
  id_number: string | null
  date_of_birth: string | null
  gender: string | null
  occupation: string | null
  id_issued_date: string | null
  id_issued_place: string | null
  id_card_front_path: string | null
  id_card_back_path: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  permanent_address: string | null
  notes: string | null
  status?: string
  created_at: string
  updated_at: string
}

interface ContractRow {
  id: string
  building_id: string
  tenant_id: string
  status?: string
  room_id?: string
  rooms?: {
    room_number?: string | null
    buildings?: { name?: string | null; slug?: string | null } | null
  } | null
}

interface ContractOccupantRow {
  id?: string
  contract_id: string
  tenant_id: string
  move_out_date?: string | null
}

function buildTenant(overrides: Partial<TenantRow>): TenantRow {
  return {
    id: 'tenant-1',
    code: 'kh-2026-0001',
    full_name: 'Tenant',
    phone: '0900000000',
    email: null,
    id_number: null,
    date_of_birth: null,
    gender: null,
    occupation: null,
    id_issued_date: null,
    id_issued_place: null,
    id_card_front_path: null,
    id_card_back_path: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    permanent_address: null,
    notes: null,
    status: 'active',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function createClientMock(input: {
  tenants: TenantRow[]
  contracts: ContractRow[]
  occupants: ContractOccupantRow[]
  relationshipRowCap?: number
  relationshipPage?: (table: string, offset: number, order: string | null) => { error?: { message: string }; count?: number | null; empty?: boolean } | undefined
}) {
  class QueryBuilder {
    private equals = new Map<string, string>()
    private notEquals = new Map<string, string>()
    private inValues = new Map<string, string[]>()
    private notInValues = new Map<string, string[]>()
    private isNull = new Set<string>()
    private search: string | null = null
    private searchColumns: string[] = []
    private sensitiveIds: string[] | null = null
    private rangeFrom = 0
    private rangeTo = Number.POSITIVE_INFINITY
    private headOnly = false
    private orderField: string | null = null
    private orderAscending = true
    private mode: 'select' | 'update' | 'delete' | 'insert' = 'select'
    private updatePayload: Record<string, unknown> | null = null

    constructor(private readonly table: string) {}

    select(_columns?: string, options?: { head?: boolean; count?: string }) {
      if (options?.head) this.headOnly = true
      return this
    }

    insert() {
      this.mode = 'insert'
      return this
    }

    update(payload: Record<string, unknown>) {
      this.mode = 'update'
      this.updatePayload = payload
      return this
    }

    delete() {
      this.mode = 'delete'
      return this
    }

    order(field: string, options?: { ascending?: boolean }) {
      this.orderField = field
      this.orderAscending = options?.ascending ?? true
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

    neq(column: string, value: string) {
      this.notEquals.set(column, value)
      return this
    }

    is(column: string, value: unknown) {
      if (value === null) this.isNull.add(column)
      return this
    }

    in(column: string, values: string[]) {
      this.inValues.set(column, values)
      return this
    }

    or(expression: string) {
      const match = expression.match(/%([^%]+)%/)
      this.search = match?.[1]?.toLowerCase() ?? null
      this.searchColumns = expression.split(',').map(part => part.split('.')[0] ?? '').filter(Boolean)
      const sensitiveMatch = expression.match(/and\(id\.in\.\(([^)]+)\),or\(/)
      if (sensitiveMatch) {
        this.sensitiveIds = sensitiveMatch[1]!.split(',')
        this.searchColumns = ['full_name', 'phone', 'code']
      }
      return this
    }

    not(column: string, operator: string, value: string) {
      if (operator === 'in') {
        const values = value.replace(/^\(|\)$/g, '').split(',').filter(Boolean)
        this.notInValues.set(column, values)
      }
      return this
    }

    maybeSingle() {
      const rows = this.applyTenantFilters([...input.tenants])
      return Promise.resolve({ data: rows[0] ?? null, error: null })
    }

    single() {
      if (this.mode === 'update') {
        const id = this.equals.get('id')
        const row = input.tenants.find(t => t.id === id)
        if (!row) return Promise.resolve({ data: null, error: { message: 'not found' } })
        Object.assign(row, this.updatePayload)
        return Promise.resolve({ data: row, error: null })
      }
      const rows = this.applyTenantFilters([...input.tenants])
      return Promise.resolve({ data: rows[0] ?? null, error: null })
    }

    private applyTenantFilters(rows: TenantRow[]) {
      const id = this.equals.get('id')
      if (id) rows = rows.filter(r => r.id === id)
      const idNumber = this.equals.get('id_number')
      if (idNumber) rows = rows.filter(r => r.id_number === idNumber)
      return rows
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
    }

    private relationshipResult<T extends { id?: string }>(rows: T[]) {
      const override = input.relationshipPage?.(this.table, this.rangeFrom, this.orderField)
      if (override?.error) return { data: null, error: override.error, count: null }
      if (this.orderField === 'id') rows.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
      const count = override && 'count' in override ? override.count : rows.length
      const end = Math.min(this.rangeTo + 1, this.rangeFrom + (input.relationshipRowCap ?? Infinity))
      return { data: override?.empty ? [] : rows.slice(this.rangeFrom, end), error: null, count }
    }

    private execute() {
      if (this.table === 'contracts') {
        let rows = [...input.contracts]
        const buildingId = this.equals.get('building_id')
        if (buildingId) rows = rows.filter(row => row.building_id === buildingId)
        const buildingIds = this.inValues.get('building_id')
        if (buildingIds) rows = rows.filter(row => buildingIds.includes(row.building_id))
        const tenantIds = this.inValues.get('tenant_id')
        if (tenantIds) rows = rows.filter(row => tenantIds.includes(row.tenant_id))
        const status = this.equals.get('status')
        if (status) rows = rows.filter(row => row.status === status)
        const tenantId = this.equals.get('tenant_id')
        if (tenantId) rows = rows.filter(row => row.tenant_id === tenantId)
        if (this.headOnly) return { data: null, error: null, count: rows.length }
        return this.relationshipResult(rows)
      }

      if (this.table === 'contract_occupants') {
        let rows = [...input.occupants]
        const contractIds = this.inValues.get('contract_id')
        if (contractIds) rows = rows.filter(row => contractIds.includes(row.contract_id))
        const tenantIds = this.inValues.get('tenant_id')
        if (tenantIds) rows = rows.filter(row => tenantIds.includes(row.tenant_id))
        const excludedContractIds = this.notInValues.get('contract_id')
        if (excludedContractIds) rows = rows.filter(row => !excludedContractIds.includes(row.contract_id))
        const tenantId = this.equals.get('tenant_id')
        if (tenantId) rows = rows.filter(row => row.tenant_id === tenantId)
        if (this.isNull.has('move_out_date')) rows = rows.filter(row => row.move_out_date == null)
        if (this.headOnly) return { data: null, error: null, count: rows.length }
        return this.relationshipResult(rows.map(row => ({ ...row, contracts: input.contracts.find(contract => contract.id === row.contract_id) })))
      }

      let rows = [...input.tenants]
      const tenantIds = this.inValues.get('id')
      if (tenantIds) rows = rows.filter(row => tenantIds.includes(row.id))
      const excludedTenantIds = this.notInValues.get('id')
      if (excludedTenantIds) rows = rows.filter(row => !excludedTenantIds.includes(row.id))
      const statusValues = this.inValues.get('status')
      if (statusValues) rows = rows.filter(row => statusValues.includes(row.status ?? 'active'))
      const notStatus = this.notEquals.get('status')
      if (notStatus) rows = rows.filter(row => (row.status ?? 'active') !== notStatus)
      if (this.search) {
        const term = this.search
        const cols = this.searchColumns.length > 0 ? this.searchColumns : ['full_name', 'phone']
        rows = rows.filter((row) => {
          return (this.sensitiveIds?.includes(row.id) && [row.email, row.id_number].some(value => value?.toLowerCase().includes(term))) || cols.some((col) => {
            const value = (row as unknown as Record<string, unknown>)[col]
            return typeof value === 'string' && value.toLowerCase().includes(term)
          })
        })
      }

      const orderField = this.orderField ?? 'full_name'
      const asc = this.orderAscending
      rows.sort((a, b) => {
        const va = (a as unknown as Record<string, unknown>)[orderField] ?? ''
        const vb = (b as unknown as Record<string, unknown>)[orderField] ?? ''
        if (va === vb) return 0
        return (va > vb ? 1 : -1) * (asc ? 1 : -1)
      })
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

  it('filters tenants with active contracts and enriches active assignments', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'primary-1', full_name: 'Binh Nguyen', phone: '0901000001' }),
        buildTenant({ id: 'occupant-1', full_name: 'An Tran', phone: '0901000002' }),
        buildTenant({ id: 'free-1', full_name: 'Cuong Le', phone: '0901000003' }),
      ],
      contracts: [
        {
          id: 'contract-1',
          building_id: 'building-1',
          tenant_id: 'primary-1',
          status: 'active',
          room_id: 'room-1',
          rooms: {
            room_number: 'A101',
            buildings: { name: 'Toa A', slug: 'toa-a' },
          },
        },
      ],
      occupants: [
        { contract_id: 'contract-1', tenant_id: 'occupant-1' },
      ],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, { contract_state: 'with_contract' })
    const assignmentByTenantId = new Map(result.items.map(tenant => [tenant.id, tenant.activeAssignment]))

    expect(result.total).toBe(2)
    expect(result.items.map(tenant => tenant.id)).toEqual(['occupant-1', 'primary-1'])
    expect(result.items.every(tenant => tenant.hasActiveContract)).toBe(true)

    expect(assignmentByTenantId.get('occupant-1')).toMatchObject({
      contractId: 'contract-1',
      roomId: 'room-1',
      roomNumber: 'A101',
      buildingId: 'building-1',
      buildingName: 'Toa A',
      buildingSlug: 'toa-a',
      assignmentRole: 'roommate',
      primaryTenantName: 'Binh Nguyen',
    })

    expect(assignmentByTenantId.get('primary-1')).toMatchObject({
      contractId: 'contract-1',
      assignmentRole: 'primary',
      primaryTenantName: null,
    })
  })

  it('filters tenants without active primary or occupant contracts', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'primary-1', full_name: 'Binh Nguyen', phone: '0901000001' }),
        buildTenant({ id: 'occupant-1', full_name: 'An Tran', phone: '0901000002' }),
        buildTenant({ id: 'free-1', full_name: 'Cuong Le', phone: '0901000003' }),
      ],
      contracts: [
        { id: 'contract-1', building_id: 'building-1', tenant_id: 'primary-1', status: 'active', room_id: 'room-1' },
      ],
      occupants: [
        { contract_id: 'contract-1', tenant_id: 'occupant-1' },
      ],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, { contract_state: 'without_contract' })

    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: 'free-1',
      hasActiveContract: false,
      activeAssignment: null,
    })
  })
})

describe('TenantRepository search and status filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches across email and id_number and code', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'a', full_name: 'Alpha', phone: '0900000001', email: 'alpha.user@example.com' }),
        buildTenant({ id: 'b', full_name: 'Beta', phone: '0900000002', id_number: '012345678901' }),
        buildTenant({ id: 'c', full_name: 'Gamma', phone: '0900000003', code: 'gam-2026-0001' }),
      ],
      contracts: [],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const byEmail = await TenantRepository.findAll({} as never, { q: 'alpha.user' })
    expect(byEmail.items.map(t => t.id)).toEqual(['a'])

    const byIdNumber = await TenantRepository.findAll({} as never, { q: '01234' })
    expect(byIdNumber.items.map(t => t.id)).toEqual(['b'])

    const byCode = await TenantRepository.findAll({} as never, { q: 'gam-' })
    expect(byCode.items.map(t => t.id)).toEqual(['c'])
  })

  it('excludes archived tenants by default', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'a', full_name: 'Active', status: 'active' }),
        buildTenant({ id: 'b', full_name: 'Archived', status: 'archived' }),
      ],
      contracts: [],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, {})
    expect(result.items.map(t => t.id)).toEqual(['a'])
  })

  it('includes explicit tenant ids when no buildings are visible', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'unassigned-1', full_name: 'Unassigned' }),
      ],
      contracts: [],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, {
      buildingIds: [],
      include_ids: ['unassigned-1'],
    })

    expect(result.items.map(t => t.id)).toEqual(['unassigned-1'])
  })

  it('returns only archived when status=archived', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'a', full_name: 'Active', status: 'active' }),
        buildTenant({ id: 'b', full_name: 'Archived', status: 'archived' }),
      ],
      contracts: [],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, { status: ['archived'] })
    expect(result.items.map(t => t.id)).toEqual(['b'])
  })

  it('sorts by created_at desc when requested', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'a', full_name: 'Alpha', created_at: '2026-01-01T00:00:00.000Z' }),
        buildTenant({ id: 'b', full_name: 'Beta', created_at: '2026-03-01T00:00:00.000Z' }),
        buildTenant({ id: 'c', full_name: 'Gamma', created_at: '2026-02-01T00:00:00.000Z' }),
      ],
      contracts: [],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, { sort: 'created_at', order: 'desc' })
    expect(result.items.map(t => t.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('TenantRepository.findUnassignedTenantIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only tenants without any contract or occupant relationship', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 'unassigned-1' }),
        buildTenant({ id: 'primary-1' }),
        buildTenant({ id: 'roommate-1' }),
      ],
      contracts: [
        { id: 'historical-contract', building_id: 'hidden-building', tenant_id: 'primary-1', status: 'terminated' },
        { id: 'occupant-contract', building_id: 'hidden-building', tenant_id: 'primary-1', status: 'active' },
      ],
      occupants: [
        { contract_id: 'occupant-contract', tenant_id: 'roommate-1', move_out_date: '2026-01-01' },
      ],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')

    await expect(TenantRepository.findUnassignedTenantIds({} as never)).resolves.toEqual(['unassigned-1'])
  })
})

describe('TenantRepository delete helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts active contracts for a tenant', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [],
      contracts: [
        { id: 'c1', building_id: 'b1', tenant_id: 't-1', status: 'active' },
        { id: 'c2', building_id: 'b1', tenant_id: 't-1', status: 'ended' },
        { id: 'c3', building_id: 'b1', tenant_id: 't-2', status: 'active' },
      ],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    expect(await TenantRepository.countActiveContractsForTenant({} as never, 't-1')).toBe(1)
    expect(await TenantRepository.countActiveContractsForTenant({} as never, 't-2')).toBe(1)
    expect(await TenantRepository.countActiveContractsForTenant({} as never, 't-missing')).toBe(0)
  })

  it('counts active occupancies (move_out_date IS NULL) for a tenant', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [],
      contracts: [],
      occupants: [
        { contract_id: 'c1', tenant_id: 't-1', move_out_date: null },
        { contract_id: 'c2', tenant_id: 't-1', move_out_date: '2026-01-01' },
        { contract_id: 'c3', tenant_id: 't-1', move_out_date: null },
      ],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    expect(await TenantRepository.countActiveOccupanciesForTenant({} as never, 't-1')).toBe(2)
    expect(await TenantRepository.countActiveOccupanciesForTenant({} as never, 't-missing')).toBe(0)
  })

  it('softArchive sets status=archived and returns mapped tenant', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 't-1', status: 'active' }),
      ],
      contracts: [],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.softArchive({} as never, 't-1')
    expect(result.status).toBe('archived')
  })

  it('setStatus flips between active and archived', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [
        buildTenant({ id: 't-1', status: 'archived' }),
      ],
      contracts: [],
      occupants: [],
    }))

    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.setStatus({} as never, 't-1', 'active')
    expect(result.status).toBe('active')
  })
})

describe('TenantRepository authorization facts', () => {
  it.each(['contracts', 'contract_occupants'])('reads capped %s pages through foreign active scope and later tenant history', async (table) => {
    const pages: { table: string; offset: number; order: string | null }[] = []
    const contracts = [
      { id: 'c-01', tenant_id: table === 'contracts' ? 'shared' : 'other', building_id: 'a', status: 'active' },
      { id: 'c-02', tenant_id: table === 'contracts' ? 'shared' : 'other', building_id: 'b', status: 'active' },
      { id: 'c-03', tenant_id: table === 'contracts' ? 'creator' : 'other', building_id: 'b', status: 'ended' },
    ]
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [], contracts,
      occupants: table === 'contract_occupants' ? [
        { id: 'o-01', contract_id: 'c-01', tenant_id: 'shared', move_out_date: null },
        { id: 'o-02', contract_id: 'c-02', tenant_id: 'shared', move_out_date: null },
        { id: 'o-03', contract_id: 'c-03', tenant_id: 'creator', move_out_date: '2020-01-01' },
      ] : [],
      relationshipRowCap: 1,
      relationshipPage: (table, offset, order) => { pages.push({ table, offset, order }); return undefined },
    }))
    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const facts = await TenantRepository.findAccessFacts({} as never, ['shared', 'creator', 'orphan'])
    expect(facts.get('shared')).toEqual({ activeBuildingIds: ['a', 'b'], historicalBuildingIds: ['a', 'b'], everContracted: true })
    expect(facts.get('creator')).toEqual({ activeBuildingIds: [], historicalBuildingIds: ['b'], everContracted: true })
    expect(facts.get('orphan')?.everContracted).toBe(false)
    expect(pages.filter(page => page.table === table)).toEqual([
      { table, offset: 0, order: 'id' }, { table, offset: 1, order: 'id' }, { table, offset: 2, order: 'id' },
    ])
  })

  it.each(['contracts', 'contract_occupants'])('rejects %s errors on a later page instead of returning partial facts', async (table) => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [],
      contracts: [
        { id: 'c-1', tenant_id: 't', building_id: 'a', status: 'active' },
        { id: 'c-2', tenant_id: 't', building_id: 'b', status: 'active' },
      ],
      occupants: [
        { id: 'o-1', contract_id: 'c-1', tenant_id: 't', move_out_date: null },
        { id: 'o-2', contract_id: 'c-2', tenant_id: 't', move_out_date: null },
      ],
      relationshipRowCap: 1,
      relationshipPage: (queriedTable, offset) => queriedTable === table && offset > 0 ? { error: { message: 'page unavailable' } } : undefined,
    }))
    const { TenantRepository } = await import('../../../server/repositories/tenants')
    await expect(TenantRepository.findAccessFacts({} as never, ['t'])).rejects.toMatchObject({ statusCode: 500 })
  })

  it.each([
    ['missing count', { count: null }],
    ['changing count', { count: 3 }],
    ['premature empty page', { empty: true }],
  ])('rejects incomplete facts with %s', async (_name, override) => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [], occupants: [], relationshipRowCap: 1,
      contracts: [
        { id: 'c-1', tenant_id: 't', building_id: 'a', status: 'active' },
        { id: 'c-2', tenant_id: 't', building_id: 'b', status: 'active' },
      ],
      relationshipPage: (table, offset) => table === 'contracts' && offset > 0 ? override : undefined,
    }))
    const { TenantRepository } = await import('../../../server/repositories/tenants')
    await expect(TenantRepository.findAccessFacts({} as never, ['t'])).rejects.toMatchObject({ statusCode: 500 })
  })

  it('unions active primary and open occupants even on ended contracts; retains all history', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [],
      contracts: [
        { id: 'primary', tenant_id: 't', building_id: 'b', status: 'active' },
        { id: 'ended', tenant_id: 'another', building_id: 'a', status: 'ended' },
        { id: 'old', tenant_id: 'another', building_id: 'c', status: 'ended' },
      ],
      occupants: [
        { contract_id: 'ended', tenant_id: 't', move_out_date: null },
        { contract_id: 'old', tenant_id: 't', move_out_date: '2020-01-01' },
      ],
    }))
    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAccessFacts({} as never, ['t', 'orphan'])
    expect(result.get('t')).toEqual({ activeBuildingIds: ['a', 'b'], historicalBuildingIds: ['a', 'b', 'c'], everContracted: true })
    expect(result.get('orphan')).toEqual({ activeBuildingIds: [], historicalBuildingIds: [], everContracted: false })
  })
  it('excludes historical-only tenants before default owner pagination, retaining building-history lookup', async () => {
    serverSupabaseClient.mockResolvedValue(createClientMock({
      tenants: [buildTenant({ id: 'old', full_name: 'A Old' }), buildTenant({ id: 'current', full_name: 'B Current' })],
      contracts: [
        { id: 'old-contract', tenant_id: 'old', building_id: 'a', status: 'ended' },
        { id: 'current-contract', tenant_id: 'current', building_id: 'a', status: 'active' },
      ], occupants: [],
    }))
    const { TenantRepository } = await import('../../../server/repositories/tenants')
    const result = await TenantRepository.findAll({} as never, { buildingIds: ['a'], active_scope_only: true, limit: 1 })
    expect(result.items.map(tenant => tenant.id)).toEqual(['current'])
    expect(result.total).toBe(1)
    const history = await TenantRepository.findAll({} as never, { building_id: 'a' })
    expect(history.items.map(tenant => tenant.id)).toEqual(['old', 'current'])
  })
})

it('restricts identity search to service-authorized full IDs while basic names stay searchable', async () => {
  serverSupabaseClient.mockResolvedValue(createClientMock({ tenants: [
    buildTenant({ id: 'basic', full_name: 'Basic Name', email: 'secret-basic@example.com', id_number: 'secret-basic' }),
    buildTenant({ id: 'full', full_name: 'Full Name', email: 'secret-full@example.com', id_number: 'secret-full' }),
  ], contracts: [], occupants: [] }))
  const { TenantRepository } = await import('../../../server/repositories/tenants')
  expect((await TenantRepository.findAll({} as never, { q: 'secret', sensitive_search_ids: ['full'] })).items.map(tenant => tenant.id)).toEqual(['full'])
  expect((await TenantRepository.findAll({} as never, { q: 'secret', sensitive_search_ids: [] })).items).toEqual([])
  expect((await TenantRepository.findAll({} as never, { q: 'Basic', sensitive_search_ids: [] })).items.map(tenant => tenant.id)).toEqual(['basic'])
})
