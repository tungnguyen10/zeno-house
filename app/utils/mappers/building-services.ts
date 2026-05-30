import type { Tables } from '~/types/database.types'
import type { BuildingService } from '~/types/building-services'
import type { PricingType } from '~/types/service-catalog'
import { mapServiceCatalog } from '~/utils/mappers/service-catalog'

type BuildingServiceRow = Tables<'building_services'> & {
  service_catalog: Tables<'service_catalog'>
}

export function mapBuildingService(row: BuildingServiceRow): BuildingService {
  return {
    id: row.id,
    buildingId: row.building_id,
    catalogId: row.catalog_id,
    catalog: mapServiceCatalog(row.service_catalog),
    defaultAmount: row.default_amount,
    pricingTypeOverride: (row.pricing_type as PricingType) ?? null,
    pricingType: (row.pricing_type as PricingType) ?? (row.service_catalog.pricing_type as PricingType),
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}
