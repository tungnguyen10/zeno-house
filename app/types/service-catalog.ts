export type PricingType = 'fixed_per_room' | 'per_person' | 'per_vehicle'

export interface ServiceCatalogItem {
  id: string
  code: string
  name: string
  buildingId: string | null
  pricingType: PricingType
  unit: string | null
  description: string | null
  isActive: boolean
  isCustom: boolean
  sortOrder: number
}
