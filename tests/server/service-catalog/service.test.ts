import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const catalogRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findCustomByName: vi.fn(),
  nextSortOrder: vi.fn(),
  createCustom: vi.fn(),
}))

const buildingRepo = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
}))

const assignmentRepo = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
}))

const auditService = vi.hoisted(() => ({ append: vi.fn() }))

vi.mock('../../../server/repositories/service-catalog', () => ({
  ServiceCatalogRepository: catalogRepo,
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: buildingRepo,
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepo,
}))

vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))

function user(role: 'admin' | 'owner' | 'manager' = 'owner'): AuthUser {
  return { id: `${role}-1`, app_metadata: { role } } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('ServiceCatalogService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildingRepo.findByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    assignmentRepo.findBuildingIdsByUser.mockResolvedValue(['building-1'])
    catalogRepo.findAll.mockResolvedValue([])
    catalogRepo.findCustomByName.mockResolvedValue(null)
    catalogRepo.nextSortOrder.mockResolvedValue(9)
    catalogRepo.createCustom.mockResolvedValue({
      id: 'catalog-1',
      buildingId: 'building-1',
      code: 'custom-building-dich-vu',
      name: 'Giặt sấy',
      pricingType: 'fixed_per_room',
      unit: 'lần',
      description: null,
      isActive: true,
      isCustom: true,
      sortOrder: 9,
    })
  })

  it('resolves building id before listing building-scoped catalog', async () => {
    const { ServiceCatalogService } = await import('../../../server/services/service-catalog')

    await ServiceCatalogService.list(event(), user('owner'), 'toa-a')

    expect(buildingRepo.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(catalogRepo.findAll).toHaveBeenCalledWith(expect.anything(), 'building-1')
  })

  it('creates a building-scoped custom service', async () => {
    const { ServiceCatalogService } = await import('../../../server/services/service-catalog')

    const result = await ServiceCatalogService.createCustom(event(), user('owner'), {
      building_id: 'toa-a',
      name: 'Giặt sấy',
      pricing_type: 'fixed_per_room',
      unit: 'lần',
      description: null,
    })

    expect(catalogRepo.findCustomByName).toHaveBeenCalledWith(expect.anything(), 'building-1', 'Giặt sấy')
    expect(catalogRepo.nextSortOrder).toHaveBeenCalledWith(expect.anything(), 'building-1')
    expect(catalogRepo.createCustom).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ building_id: 'building-1', sort_order: 9 }),
    )
    expect(result.isCustom).toBe(true)
    expect(auditService.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'owner-1' }),
      expect.objectContaining({
        building_id: 'building-1',
        action: 'service_catalog_item.created',
        entity_type: 'service_catalog_item',
        entity_id: 'catalog-1',
        after_data: result,
      }),
    )
  })

  it('rejects duplicate custom service names in the same building', async () => {
    catalogRepo.findCustomByName.mockResolvedValue({ id: 'existing-1' })
    const { ServiceCatalogService } = await import('../../../server/services/service-catalog')

    await expect(ServiceCatalogService.createCustom(event(), user('owner'), {
      building_id: 'toa-a',
      name: 'Giặt sấy',
      pricing_type: 'fixed_per_room',
      unit: null,
      description: null,
    })).rejects.toThrow('Tòa nhà này đã có dịch vụ cùng tên')

    expect(catalogRepo.createCustom).not.toHaveBeenCalled()
  })
})
