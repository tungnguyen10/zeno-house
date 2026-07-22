import { vi } from 'vitest'

const serverSupabaseClient = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseClient,
  serverSupabaseServiceRole: serverSupabaseClient,
}))

function buildBuildingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'building-1',
    slug: 'toa-a',
    name: 'Toa A',
    address: '123 Street',
    description: null,
    status: 'active',
    owner_name: null,
    owner_phone: null,
    owner_email: null,
    electricity_pricing_type: 'per_kwh',
    default_electricity_rate: null,
    water_pricing_type: 'per_m3',
    default_water_rate: null,
    meter_reading_day: null,
    billing_generation_day: null,
    payment_due_day: null,
    grace_period_days: 0,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    rooms: [{ count: 0 }],
    ...overrides,
  }
}

function createClientMock() {
  const calls = {
    eq: [] as Array<{ table: string; column: string; value: string }>,
    updates: [] as Array<Record<string, unknown>>,
  }

  class QueryBuilder {
    private updatePayload: Record<string, unknown> | null = null

    constructor(private readonly table: string) {}

    select() {
      return this
    }

    update(payload: Record<string, unknown>) {
      this.updatePayload = payload
      calls.updates.push(payload)
      return this
    }

    eq(column: string, value: string) {
      calls.eq.push({ table: this.table, column, value })
      return this
    }

    in() {
      return this
    }

    single() {
      return Promise.resolve({
        data: buildBuildingRow(this.updatePayload ?? {}),
        error: null,
      })
    }

    maybeSingle() {
      return Promise.resolve({ data: buildBuildingRow(), error: null })
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      const value = this.table === 'building_services'
        ? { data: [], error: null, count: 0 }
        : { data: [buildBuildingRow()], error: null, count: 1 }
      return Promise.resolve(value).then(onfulfilled, onrejected)
    }
  }

  return {
    calls,
    client: {
      from: (table: string) => new QueryBuilder(table),
    },
  }
}

describe('BuildingRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not regenerate slug when updating only the building name', async () => {
    const mock = createClientMock()
    serverSupabaseClient.mockReturnValue(mock.client)
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    const result = await BuildingRepository.update(
      {} as never,
      'building-1',
      { name: 'Toa A moi' } as never,
    )

    expect(mock.calls.updates[0]).toEqual({ name: 'Toa A moi' })
    expect(result.slug).toBe('toa-a')
  })

  it('looks up persisted slugs by slug and UUIDs by id', async () => {
    const mock = createClientMock()
    serverSupabaseClient.mockReturnValue(mock.client)
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    await BuildingRepository.findByIdentifier({} as never, 'toa-a')
    await BuildingRepository.findByIdentifier({} as never, '11111111-1111-4111-8111-111111111111')

    expect(mock.calls.eq.filter(call => call.table === 'buildings')).toEqual([
      { table: 'buildings', column: 'slug', value: 'toa-a' },
      { table: 'buildings', column: 'id', value: '11111111-1111-4111-8111-111111111111' },
    ])
  })

  it('memoizes the same building lookup for one request', async () => {
    const mock = createClientMock()
    serverSupabaseClient.mockReturnValue(mock.client)
    const event = { context: {} } as never
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    await BuildingRepository.findByIdentifier(event, 'toa-a')
    await BuildingRepository.findByIdentifier(event, 'toa-a')

    expect(mock.calls.eq.filter(call => call.table === 'buildings')).toEqual([
      { table: 'buildings', column: 'slug', value: 'toa-a' },
    ])
  })
})
