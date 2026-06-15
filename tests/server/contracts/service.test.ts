import { vi } from 'vitest'
import { buildContract } from '../../__fixtures__/billing/contract'

const mocks = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
  findActiveByRoomId: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../../server/repositories/contracts', () => ({
  ContractRepository: {
    findByIdentifier: mocks.findByIdentifier,
    findActiveByRoomId: mocks.findActiveByRoomId,
    update: mocks.update,
    remove: mocks.remove,
  },
}))

vi.mock('../../../server/repositories/rooms', () => ({
  RoomRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../../server/repositories/contract-occupants', () => ({
  ContractOccupantRepository: {
    findActiveOccupancyByTenant: vi.fn(),
  },
}))

vi.mock('../../../server/services/contract-services', () => ({
  ContractServiceService: {
    cloneFromBuilding: vi.fn(),
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
