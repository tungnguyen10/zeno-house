export type BuildingStatus = 'active' | 'inactive'
export type ElectricityPricingType = 'per_kwh' | 'fixed' | 'tiered'
export type WaterPricingType = 'per_m3' | 'per_person' | 'fixed_per_room'

export interface ServiceFeeDefault {
  code: string
  name: string
  pricing_type: 'fixed_per_room' | 'per_vehicle' | 'per_person'
  amount: number
  enabled: boolean
}

export interface BuildingServiceSummary {
  totalCount: number
  activeCount: number
  activeNames: string[]
}

export interface Building {
  id: string
  slug: string
  code: string
  name: string
  address: string
  description: string | null
  status: BuildingStatus
  totalRooms: number
  serviceSummary: BuildingServiceSummary
  // Operational config
  ownerName: string | null
  ownerPhone: string | null
  ownerEmail: string | null
  electricityPricingType: ElectricityPricingType
  defaultElectricityRate: number | null
  waterPricingType: WaterPricingType
  defaultWaterRate: number | null
  meterReadingDay: number | null
  billingGenerationDay: number | null
  paymentDueDay: number | null
  gracePeriodDays: number
  // Ownership provenance (non-sensitive identifiers). Access control still comes
  // from user_building_assignments, not these fields.
  createdBy: string | null
  ownerUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface BuildingInput {
  name: string
  slug?: string
  address: string
  description?: string | null
  status?: BuildingStatus
  ownerName?: string | null
  ownerPhone?: string | null
  ownerEmail?: string | null
  electricityPricingType?: ElectricityPricingType
  defaultElectricityRate?: number | null
  waterPricingType?: WaterPricingType
  defaultWaterRate?: number | null
  meterReadingDay?: number | null
  billingGenerationDay?: number | null
  paymentDueDay?: number | null
  gracePeriodDays?: number
}

export type BuildingUpdateInput = Partial<BuildingInput>
