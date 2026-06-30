import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  findBuildingByIdentifier: vi.fn(),
  findByBuilding: vi.fn(),
  syncFromBuilding: vi.fn(),
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier: mocks.findBuildingByIdentifier,
  },
}))

vi.mock('../../../server/repositories/contract-services', () => ({
  ContractServiceRepository: {
    findByBuilding: mocks.findByBuilding,
    syncFromBuilding: mocks.syncFromBuilding,
  },
}))

function user(): AuthUser {
  return { id: 'user-1', app_metadata: { role: 'admin' } } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('ContractServiceService building identifier lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves a building slug before loading contract services', async () => {
    mocks.findBuildingByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    mocks.findByBuilding.mockResolvedValue([])
    const { ContractServiceService } = await import('../../../server/services/contract-services')

    const result = await ContractServiceService.listByBuilding(event(), user(), 'toa-a')

    expect(mocks.findBuildingByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(mocks.findByBuilding).toHaveBeenCalledWith(expect.anything(), 'building-1')
    expect(result).toEqual([])
  })

  it('resolves a building slug before syncing services to active contracts', async () => {
    mocks.findBuildingByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    mocks.syncFromBuilding.mockResolvedValue(2)
    const { ContractServiceService } = await import('../../../server/services/contract-services')

    const result = await ContractServiceService.syncFromBuilding(event(), user(), 'toa-a')

    expect(mocks.findBuildingByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(mocks.syncFromBuilding).toHaveBeenCalledWith(expect.anything(), 'building-1')
    expect(result).toBe(2)
  })
})
