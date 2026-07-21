import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  findBuilding: vi.fn(),
  findById: vi.fn(),
  findByBuildingAndCatalog: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  auditAppend: vi.fn(),
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findByIdentifier: mocks.findBuilding },
}))
vi.mock('../../../server/repositories/building-services', () => ({
  BuildingServiceRepository: {
    findById: mocks.findById,
    findByBuildingAndCatalog: mocks.findByBuildingAndCatalog,
    upsert: mocks.upsert,
    update: mocks.update,
  },
}))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: mocks.auditAppend } }))

function event() { return { context: {} } as never }
function user(): AuthUser { return { id: 'admin-1', app_metadata: { role: 'admin' } } as AuthUser }

describe('BuildingServiceService audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findBuilding.mockResolvedValue({ id: 'building-1' })
  })

  it('audits an upsert with the previous row when it exists', async () => {
    const before = { id: 'service-1', buildingId: 'building-1', catalogId: 'catalog-1', defaultAmount: 100 }
    const after = { ...before, defaultAmount: 125 }
    mocks.findByBuildingAndCatalog.mockResolvedValue(before)
    mocks.upsert.mockResolvedValue(after)
    const { BuildingServiceService } = await import('../../../server/services/building-services')

    await BuildingServiceService.upsert(event(), user(), {
      building_id: 'building-1', catalog_id: 'catalog-1', default_amount: 125,
    } as never)

    expect(mocks.auditAppend).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.objectContaining({
        building_id: 'building-1', action: 'building_service.updated',
        entity_type: 'building_service', entity_id: 'service-1', before_data: before, after_data: after,
      }),
    )
  })

  it('audits a direct update with before and after snapshots', async () => {
    const before = { id: 'service-1', buildingId: 'building-1', defaultAmount: 100 }
    const after = { ...before, defaultAmount: 125 }
    mocks.findById.mockResolvedValue(before)
    mocks.update.mockResolvedValue(after)
    const { BuildingServiceService } = await import('../../../server/services/building-services')

    await BuildingServiceService.update(event(), user(), 'service-1', { default_amount: 125 } as never)

    expect(mocks.auditAppend).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.objectContaining({
        action: 'building_service.updated', before_data: before, after_data: after,
      }),
    )
  })
})
