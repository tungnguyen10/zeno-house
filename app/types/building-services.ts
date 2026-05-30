import type { PricingType, ServiceCatalogItem } from '~/types/service-catalog'

export interface BuildingService {
  id: string
  buildingId: string
  catalogId: string
  catalog: ServiceCatalogItem
  defaultAmount: number
  /** Override pricing type for this building; null = use catalog default */
  pricingTypeOverride: PricingType | null
  /** Effective pricing type (override ?? catalog default) */
  pricingType: PricingType
  isActive: boolean
  sortOrder: number
}
