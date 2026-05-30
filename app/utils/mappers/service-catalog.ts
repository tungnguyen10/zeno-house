import type { Tables } from '~/types/database.types'
import type { ServiceCatalogItem } from '~/types/service-catalog'

export function mapServiceCatalog(row: Tables<'service_catalog'>): ServiceCatalogItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    pricingType: row.pricing_type as ServiceCatalogItem['pricingType'],
    unit: row.unit,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}
