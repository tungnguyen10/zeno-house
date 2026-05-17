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

export interface Building {
  id: string
  name: string
  address: string
  description: string | null
  status: BuildingStatus
  totalRooms: number
  // Operational config
  ownerName: string | null
  ownerPhone: string | null
  ownerEmail: string | null
  electricityPricingType: ElectricityPricingType
  defaultElectricityRate: number | null
  waterPricingType: WaterPricingType
  defaultWaterRate: number | null
  defaultServiceFees: ServiceFeeDefault[] | null
  meterReadingDay: number | null
  billingGenerationDay: number | null
  paymentDueDay: number | null
  gracePeriodDays: number
  createdAt: string
  updatedAt: string
}

export interface BuildingInput {
  name: string
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
  defaultServiceFees?: ServiceFeeDefault[] | null
  meterReadingDay?: number | null
  billingGenerationDay?: number | null
  paymentDueDay?: number | null
  gracePeriodDays?: number
}

export type BuildingUpdateInput = Partial<BuildingInput>
