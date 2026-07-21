import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  findBuildingByIdentifier: vi.fn(),
  findByBuilding: vi.fn(),
  findById: vi.fn(),
  findContractById: vi.fn(),
  update: vi.fn(),
  syncFromBuilding: vi.fn(),
  auditAppend: vi.fn(),
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier: mocks.findBuildingByIdentifier,
  },
}))

vi.mock('../../../server/repositories/contract-services', () => ({
  ContractServiceRepository: {
    findByBuilding: mocks.findByBuilding,
    findById: mocks.findById,
    update: mocks.update,
    syncFromBuilding: mocks.syncFromBuilding,
  },
}))

vi.mock('../../../server/repositories/contracts', () => ({
  ContractRepository: { findById: mocks.findContractById },
}))

vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: mocks.auditAppend },
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
    expect(mocks.syncFromBuilding).toHaveBeenCalledWith(expect.anything(), 'building-1', 'user-1')
    expect(result).toBe(2)
    expect(mocks.auditAppend).not.toHaveBeenCalled()
  })

  it('audits a contract service update with before and after snapshots', async () => {
    const before = { id: 'service-1', contractId: 'contract-1', amount: 100, isEnabled: true }
    const after = { ...before, amount: 125 }
    mocks.findById.mockResolvedValue(before)
    mocks.findContractById.mockResolvedValue({ id: 'contract-1', buildingId: 'building-1' })
    mocks.update.mockResolvedValue(after)
    const { ContractServiceService } = await import('../../../server/services/contract-services')

    await ContractServiceService.update(event(), user(), 'service-1', { amount: 125 } as never)

    expect(mocks.auditAppend).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({
        building_id: 'building-1',
        action: 'contract_service.updated',
        entity_type: 'contract_service',
        entity_id: 'service-1',
        before_data: before,
        after_data: after,
      }),
    )
  })
})
