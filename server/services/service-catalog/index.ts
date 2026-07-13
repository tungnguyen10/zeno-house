import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ServiceCatalogItem } from '~/types/service-catalog'
import type { ServiceCatalogCreateInput } from '~/utils/validators/service-catalog'
import { ServiceCatalogRepository } from '../../repositories/service-catalog'
import { BuildingRepository } from '../../repositories/buildings'
import { assertBuildingScope } from '../../utils/scope'
import { TtlCache } from '../../utils/ttl-cache'

const catalogCache = new TtlCache<ServiceCatalogItem[]>(250)
const CATALOG_TTL_MS = 300_000

export const ServiceCatalogService = {
  async list(event: H3Event, user: AuthUser, buildingIdentifier?: string): Promise<ServiceCatalogItem[]> {
    if (!can(user, 'building-services.read')) throwForbidden('Không có quyền xem danh mục dịch vụ')
    if (!buildingIdentifier) {
      const cached = catalogCache.get('global')
      if (cached) return cached
      const items = await ServiceCatalogRepository.findAll(event)
      catalogCache.set('global', items, CATALOG_TTL_MS)
      return items
    }

    const building = await BuildingRepository.findByIdentifier(event, buildingIdentifier)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, building.id, 'read')
    const key = `building:${building.id}`
    const cached = catalogCache.get(key)
    if (cached) return cached
    const items = await ServiceCatalogRepository.findAll(event, building.id)
    catalogCache.set(key, items, CATALOG_TTL_MS)
    return items
  },

  async createCustom(event: H3Event, user: AuthUser, input: ServiceCatalogCreateInput): Promise<ServiceCatalogItem> {
    if (!can(user, 'building-services.write')) throwForbidden('Không có quyền tạo dịch vụ')

    const building = await BuildingRepository.findByIdentifier(event, input.building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, building.id, 'write')

    const existing = await ServiceCatalogRepository.findCustomByName(event, building.id, input.name)
    if (existing) throwConflict('Tòa nhà này đã có dịch vụ cùng tên')

    const sortOrder = await ServiceCatalogRepository.nextSortOrder(event, building.id)
    const created = await ServiceCatalogRepository.createCustom(event, {
      ...input,
      building_id: building.id,
      sort_order: sortOrder,
    })
    catalogCache.delete(`building:${building.id}`)
    return created
  },
}
