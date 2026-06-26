import { vi } from 'vitest'
import { buildContract } from '../../__fixtures__/billing/contract'

const mocks = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
  findAll: vi.fn(),
  findActiveByRoomId: vi.fn(),
  findActiveByTenantId: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  createWithHandover: vi.fn(),
  findBuildingByIdentifier: vi.fn(),
  findRoomById: vi.fn(),
  updateRoom: vi.fn(),
  findActiveOccupancyByTenant: vi.fn(),
  cloneFromBuilding: vi.fn(),
}))

vi.mock('../../../server/repositories/contracts', () => ({
  ContractRepository: {
    findByIdentifier: mocks.findByIdentifier,
    findAll: mocks.findAll,
    findActiveByRoomId: mocks.findActiveByRoomId,
    findActiveByTenantId: mocks.findActiveByTenantId,
    update: mocks.update,
    remove: mocks.remove,
    createWithHandover: mocks.createWithHandover,
  },
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier: mocks.findBuildingByIdentifier,
  },
}))

vi.mock('../../../server/repositories/rooms', () => ({
  RoomRepository: {
    findById: mocks.findRoomById,
    update: mocks.updateRoom,
  },
}))

vi.mock('../../../server/repositories/contract-occupants', () => ({
  ContractOccupantRepository: {
    findActiveOccupancyByTenant: mocks.findActiveOccupancyByTenant,
  },
}))

vi.mock('../../../server/services/contract-services', () => ({
  ContractServiceService: {
    cloneFromBuilding: mocks.cloneFromBuilding,
  },
}))

function buildContractWithDetails() {
  return {
    ...buildContract(),
    room: {
      id: 'room-1',
      roomNumber: 'A101',
      floor: 1,
      buildingId: 'building-1',
      buildingName: 'Toa A',
    },
    tenant: {
      id: 'tenant-1',
      fullName: 'An Tran',
      phone: '0901000001',
    },
  }
}

describe('ContractService code lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves building slug filters before listing contracts', async () => {
    const contract = buildContractWithDetails()
    mocks.findBuildingByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    mocks.findAll.mockResolvedValue({ items: [contract], total: 1 })
    const { ContractService } = await import('../../../server/services/contracts')

    const result = await ContractService.list(
      {} as never,
      { id: 'user-1' } as never,
      { building_id: 'toa-a', status: 'active' },
    )

    expect(mocks.findBuildingByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(mocks.findAll).toHaveBeenCalledWith(expect.anything(), { building_id: 'building-1', status: 'active' })
    expect(result.total).toBe(1)
  })

  it('loads contract detail by persisted contract code', async () => {
    const contract = buildContractWithDetails()
    mocks.findByIdentifier.mockResolvedValue(contract)
    const { ContractService } = await import('../../../server/services/contracts')

    const result = await ContractService.get({} as never, { id: 'user-1' } as never, 'hd-2026-0001')

    expect(mocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'hd-2026-0001')
    expect(result.id).toBe(contract.id)
  })

  it('updates by contract code after resolving the UUID', async () => {
    const contract = buildContractWithDetails()
    const updated = { ...contract, notes: 'updated' }
    mocks.findByIdentifier.mockResolvedValue(contract)
    mocks.findActiveByRoomId.mockResolvedValue(null)
    mocks.update.mockResolvedValue(updated)
    const { ContractService } = await import('../../../server/services/contracts')

    const result = await ContractService.update(
      {} as never,
      { id: 'user-1' } as never,
      'hd-2026-0001',
      { notes: 'updated' },
    )

    expect(mocks.findActiveByRoomId).toHaveBeenCalledWith(expect.anything(), contract.roomId, contract.id)
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), contract.id, { notes: 'updated' })
    expect(result.notes).toBe('updated')
  })
})

describe('ContractService.create with handover readings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes handover readings + resolved rent and building_id to the RPC repository call', async () => {
    const contract = buildContractWithDetails()
    mocks.findRoomById.mockResolvedValue({
      id: 'room-1',
      roomNumber: 'A101',
      status: 'available',
      buildingId: 'building-1',
      monthlyRent: 3_000_000,
    })
    mocks.findActiveByRoomId.mockResolvedValue(null)
    mocks.findActiveByTenantId.mockResolvedValue(null)
    mocks.findActiveOccupancyByTenant.mockResolvedValue(null)
    mocks.createWithHandover.mockResolvedValue(contract)

    const { ContractService } = await import('../../../server/services/contracts')

    const result = await ContractService.create(
      {} as never,
      { id: 'user-1' } as never,
      {
        room_id: 'room-1',
        tenant_id: 'tenant-1',
        start_date: '2026-06-01',
        end_date: '2027-06-01',
        monthly_rent: 0,
        deposit: 3_000_000,
        payment_day: 5,
        occupant_count: 2,
        discount_amount: 0,
        surcharge_amount: 0,
        status: 'active',
        notes: null,
        handover_electricity_reading: 1250,
        handover_water_reading: 80,
        handover_reading_date: '2026-06-01',
      },
    )

    expect(mocks.createWithHandover).toHaveBeenCalledTimes(1)
    const [, payload, recordedBy] = mocks.createWithHandover.mock.calls[0]!
    expect(payload).toMatchObject({
      room_id: 'room-1',
      tenant_id: 'tenant-1',
      building_id: 'building-1',
      monthly_rent: 3_000_000,
      handover_electricity_reading: 1250,
      handover_water_reading: 80,
      handover_reading_date: '2026-06-01',
    })
    expect(recordedBy).toBe('user-1')
    expect(result.id).toBe(contract.id)
  })

  it('refuses to create a contract when the room has no rent set', async () => {
    mocks.findRoomById.mockResolvedValue({
      id: 'room-1',
      roomNumber: 'A101',
      status: 'available',
      buildingId: 'building-1',
      monthlyRent: 0,
    })
    mocks.findActiveByRoomId.mockResolvedValue(null)
    mocks.findActiveByTenantId.mockResolvedValue(null)
    mocks.findActiveOccupancyByTenant.mockResolvedValue(null)

    const { ContractService } = await import('../../../server/services/contracts')

    await expect(
      ContractService.create(
        {} as never,
        { id: 'user-1' } as never,
        {
          room_id: 'room-1',
          tenant_id: 'tenant-1',
          start_date: '2026-06-01',
          end_date: '2027-06-01',
          monthly_rent: 0,
          deposit: 0,
          payment_day: null,
          occupant_count: 1,
          discount_amount: 0,
          surcharge_amount: 0,
          status: 'active',
          notes: null,
          handover_electricity_reading: 0,
          handover_water_reading: 0,
        },
      ),
    ).rejects.toThrow()

    expect(mocks.createWithHandover).not.toHaveBeenCalled()
  })
})
