import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc, from }) }))

function slugLookupReturnsEmpty() {
  // Covers buildUniqueSlug/Code (.limit) and attachServiceSummaries (.in).
  const chain = {
    select: () => chain, eq: () => chain, neq: () => chain,
    limit: async () => ({ data: [], error: null }),
    in: async () => ({ data: [], error: null }),
  }
  from.mockReturnValue(chain)
}

const buildingRow = {
  id: 'b-1', slug: 'toa-a', code: 'toaa', name: 'Tòa A', address: '123 Lê Lợi', description: null,
  status: 'active', owner_name: null, owner_phone: null, owner_email: null,
  electricity_pricing_type: 'per_kwh', default_electricity_rate: null, water_pricing_type: 'per_m3',
  default_water_rate: null, meter_reading_day: null, billing_generation_day: null, payment_due_day: null,
  grace_period_days: 0, created_by: 'u-1', owner_user_id: null,
  created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}

const input = { name: 'Tòa A', address: '123 Lê Lợi', status: 'active', electricity_pricing_type: 'per_kwh', water_pricing_type: 'per_m3', grace_period_days: 0 } as never
const opts = { actorId: 'u-1', ownerUserId: null, requestId: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f' }

beforeEach(() => {
  vi.resetAllMocks()
  slugLookupReturnsEmpty()
})

describe('BuildingRepository.createWithRooms', () => {
  it('sends slugged rooms and provenance to the RPC', async () => {
    rpc.mockResolvedValue({ data: { building: buildingRow, rooms: [], replayed: false }, error: null })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    await BuildingRepository.createWithRooms({ context: {} } as never, input, [
      { room_number: 'P 101', floor: 1, monthly_rent: 1, area: null },
    ], opts)

    expect(rpc).toHaveBeenCalledWith('create_building_with_rooms', expect.objectContaining({
      p_actor_id: 'u-1',
      p_assign_owner: null,
      p_request_id: opts.requestId,
      p_rooms: [{ room_number: 'P 101', slug: 'p-101', floor: 1, monthly_rent: 1, area: null }],
      p_building: expect.objectContaining({ slug: 'toa-a', created_by: 'u-1', owner_user_id: null }),
    }))
  })

  it.each(['slug', 'code'])('retries with fresh identifiers when building %s collides', async (identity) => {
    const defaultChain = from.getMockImplementation()!()
    from.mockImplementation(table => {
      if (table !== 'buildings') return defaultChain
      let column: string
      let candidate: string
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => { column = key; candidate = value; return chain },
        limit: async () => ({
          data: rpc.mock.calls.length > 0 && column === identity && candidate === (identity === 'slug' ? 'toa-a' : 'ta') ? [{ id: 'racing-building' }] : [],
          error: null,
        }),
      }
      return chain
    })
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "buildings_${identity}_uq"` } })
      .mockResolvedValueOnce({ data: { building: buildingRow, rooms: [], replayed: false }, error: null })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    const result = await BuildingRepository.createWithRooms({ context: {} } as never, input, [], opts)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(result.building.id).toBe('b-1')
    expect(rpc.mock.calls[1]![1].p_building).toMatchObject(identity === 'slug'
      ? { slug: 'toa-a-2', code: 'ta2' }
      : { slug: 'toa-a', code: 'ta2' })
    expect(rpc.mock.calls[1]![1]).toMatchObject({ p_request_id: opts.requestId, p_actor_id: opts.actorId })
  })

  it('gives up after 3 slug collisions', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'violates unique constraint "buildings_code_uq"' } })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    await expect(BuildingRepository.createWithRooms({ context: {} } as never, input, [], opts)).rejects.toMatchObject({ statusCode: 409 })
    expect(rpc).toHaveBeenCalledTimes(3)
  })
})

describe('RPC result and failure mapping', () => {
  it('maps room DTOs, room count, services, owner assignment and replay state', async () => {
    const roomRow = {
      id: 'r-1', building_id: 'b-1', room_number: 'P101', slug: 'p101', code: 'toaa.p101',
      floor: 2, monthly_rent: 5000000, area: 25, description: null, status: 'available',
      created_at: buildingRow.created_at, updated_at: buildingRow.updated_at,
    }
    const lookupChain = from.getMockImplementation()!()
    from.mockImplementation(table => table === 'building_services'
      ? { select: () => ({ in: async () => ({ data: [{ building_id: 'b-1', is_active: true, service_catalog: { name: 'Điện' } }], error: null }) }) }
      : lookupChain)
    rpc.mockResolvedValue({ data: { building: buildingRow, rooms: [roomRow], replayed: true }, error: null })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    const result = await BuildingRepository.createWithRooms({ context: {} } as never, input, [], { ...opts, ownerUserId: 'owner-1' })
    expect(result).toMatchObject({ replayed: true, building: { totalRooms: 1, serviceSummary: { totalCount: 1, activeCount: 1, activeNames: ['Điện'] } }, rooms: [{ id: 'r-1', buildingId: 'b-1', roomNumber: 'P101', monthlyRent: 5000000 }] })
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_assign_owner: 'owner-1', p_building: { owner_user_id: 'owner-1' } })
  })

  it.each([
    ['ROOM_BATCH_DUPLICATE', 409],
    ['BUILDING_SETUP_REQUEST_CONFLICT', 409],
    ['ROOM_BATCH_INVALID', 422],
    ['unknown database failure', 500],
    ['violates unique constraint "rooms_building_slug_uq"', 500],
  ])('does not retry %s and maps to %s', async (message, statusCode) => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message } })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')
    await expect(BuildingRepository.createWithRooms({ context: {} } as never, input, [], opts)).rejects.toMatchObject({ statusCode })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('throwBuildingSetupError', () => {
  it('maps ROOM_BATCH_DUPLICATE to 409 with duplicate_room_numbers', async () => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    try {
      throwBuildingSetupError({ code: '23505', message: 'ROOM_BATCH_DUPLICATE', details: '["P101","P102"]' })
      throw new Error('expected throw')
    }
    catch (e) {
      expect(e).toMatchObject({
        statusCode: 409,
        data: { error: { details: { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: ['P101', 'P102'] } } },
      })
    }
  })

  it('maps foreign request replay to a generic 409 without data', async () => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    try {
      throwBuildingSetupError({ code: '23505', message: 'BUILDING_SETUP_REQUEST_CONFLICT' })
      throw new Error('expected throw')
    }
    catch (e) {
      expect(e).toMatchObject({ statusCode: 409, data: { error: { details: { reason: 'BUILDING_SETUP_REQUEST_CONFLICT' } } } })
    }
  })

  it.each([undefined, 'invalid json', '{}', '["P101",2,null]'])('safely parses duplicate details %s', async (details) => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    expect(() => throwBuildingSetupError({ message: 'ROOM_BATCH_DUPLICATE', details })).toThrowError()
    try {
      throwBuildingSetupError({ message: 'ROOM_BATCH_DUPLICATE', details })
    }
    catch (error) {
      expect(error).toMatchObject({ statusCode: 409, data: { error: { details: { duplicate_room_numbers: details === '["P101",2,null]' ? ['P101'] : [] } } } })
    }
  })

  it('returns without throwing for unknown errors', async () => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    expect(() => throwBuildingSetupError({ code: 'XX000', message: 'boom' })).not.toThrow()
  })
})
