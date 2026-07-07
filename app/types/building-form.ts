export interface BuildingFormData {
  name: string
  address: string
  description: string
  status: 'active' | 'inactive'
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  electricityPricingType: 'per_kwh' | 'fixed' | 'tiered'
  defaultElectricityRate: string
  waterPricingType: 'per_m3' | 'per_person' | 'fixed_per_room'
  defaultWaterRate: string
  meterReadingDay: string
  billingGenerationDay: string
  paymentDueDay: string
  gracePeriodDays: string
  operationalStartYear: string
  operationalStartMonth: string
}
