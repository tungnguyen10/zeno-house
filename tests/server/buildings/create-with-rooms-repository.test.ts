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
  vi.clearAllMocks()
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

  it('retries with a fresh slug when building slug/code collides', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "buildings_slug_uq"' } })
      .mockResolvedValueOnce({ data: { building: buildingRow, rooms: [], replayed: false }, error: null })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    const result = await BuildingRepository.createWithRooms({ context: {} } as never, input, [], opts)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(result.building.id).toBe('b-1')
  })

  it('gives up after 3 slug collisions', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'violates unique constraint "buildings_code_uq"' } })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    await expect(BuildingRepository.createWithRooms({ context: {} } as never, input, [], opts)).rejects.toMatchObject({ statusCode: 409 })
    expect(rpc).toHaveBeenCalledTimes(3)
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

  it('returns without throwing for unknown errors', async () => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    expect(() => throwBuildingSetupError({ code: 'XX000', message: 'boom' })).not.toThrow()
  })
})
