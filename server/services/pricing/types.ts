export interface RoomBillingInput {
  contract: {
    id: string
    roomId: string
    tenantId: string
    monthlyRent: number
    surchargeAmount: number
    discountAmount: number
    paymentDay: number | null
    occupantCount: number
  }
  services: {
    catalogId: string
    name: string
    pricingType: 'fixed' | 'per_person'
    amount: number
    quantity: number
  }[]
  meterReadings: {
    meterType: 'electricity' | 'water'
    oldReading: number | null
    newReading: number | null
    consumption: number | null
    isAdjusted: boolean
    adjustmentReason: string | null
  }[]
  buildingRates: {
    electricityRate: number | null
    waterRate: number | null
    waterPricingType: 'per_unit' | 'per_person'
  }
}

export interface RoomBillingResult {
  amounts: {
    rentAmount: number
    serviceAmount: number
    electricityAmount: number
    waterAmount: number
    utilityAmount: number
    totalAmount: number
  }
  contractSnapshot: {
    monthlyRent: number
    surchargeAmount: number
    discountAmount: number
    paymentDay: number | null
    occupantCount: number
  }
  serviceSnapshots: {
    catalogId: string
    serviceName: string
    pricingType: 'fixed' | 'per_person'
    amount: number
    quantity: number
    total: number
  }[]
  utilitySnapshots: {
    meterType: 'electricity' | 'water'
    oldReading: number | null
    newReading: number | null
    consumption: number | null
    unitPrice: number | null
    total: number
    isAdjusted: boolean
    adjustmentReason: string | null
  }[]
  warnings: BillingWarning[]
}

export type BillingWarning =
  | { type: 'missing_reading'; meterType: string }
  | { type: 'negative_consumption'; meterType: string; value: number }
  | { type: 'no_rate_configured'; meterType: string }
  | { type: 'zero_rent' }
