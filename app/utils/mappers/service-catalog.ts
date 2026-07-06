import type { Tables } from '~/types/database.types'
import type { ServiceCatalogItem } from '~/types/service-catalog'

type ServiceCatalogRow = Tables<'service_catalog'> & {
  building_id?: string | null
}

export function mapServiceCatalog(row: ServiceCatalogRow): ServiceCatalogItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    buildingId: row.building_id ?? null,
    pricingType: row.pricing_type as ServiceCatalogItem['pricingType'],
    unit: row.unit,
    description: row.description,
    isActive: row.is_active,
    isCustom: Boolean(row.building_id),
    sortOrder: row.sort_order,
  }
}
