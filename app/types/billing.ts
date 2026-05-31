export type BillingPeriodStatus = 'draft' | 'finalized'
export type BillingRunStatus = 'draft' | 'generated'
export type BillingPaymentStatus = 'unpaid' | 'paid'
export type BillingPaymentMethod = 'cash' | 'bank_transfer' | 'other'

export interface BillingPeriod {
  id: string
  buildingId: string
  periodYear: number
  periodMonth: number
  status: BillingPeriodStatus
  finalizedAt: string | null
  finalizedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BillingRun {
  id: string
  billingPeriodId: string
  buildingId: string
  status: BillingRunStatus
  schemaVersion: number
  generatedAt: string | null
  generatedBy: string | null
  itemCount: number
  totalAmount: number
  createdAt: string
  updatedAt: string
}

export interface BillingItem {
  id: string
  billingRunId: string
  roomId: string
  contractId: string
  tenantId: string
  rentAmount: number
  serviceAmount: number
  electricityAmount: number
  waterAmount: number
  utilityAmount: number
  totalAmount: number
  paymentStatus: BillingPaymentStatus
  paidAt: string | null
  paidBy: string | null
  paymentMethod: BillingPaymentMethod | null
  paymentNote: string | null
  createdAt: string
  updatedAt: string
}

export interface BillingItemSummary extends BillingItem {
  room: {
    id: string
    roomNumber: string
    floor: number
  }
  tenant: {
    id: string
    fullName: string
    phone: string
  }
}

export interface BillingContractSnapshot {
  id: string
  billingItemId: string
  monthlyRent: number
  surchargeAmount: number
  discountAmount: number
  paymentDay: number | null
  occupantCount: number
  createdAt: string
}

export interface BillingServiceSnapshot {
  id: string
  billingItemId: string
  catalogId: string | null
  serviceName: string
  pricingType: 'fixed' | 'per_person'
  amount: number
  quantity: number
  total: number
  createdAt: string
}

export interface BillingUtilitySnapshot {
  id: string
  billingItemId: string
  meterType: 'electricity' | 'water'
  oldReading: number | null
  newReading: number | null
  consumption: number | null
  unitPrice: number | null
  total: number
  isAdjusted: boolean
  adjustmentReason: string | null
  createdAt: string
}

export interface BillingItemDetail extends BillingItemSummary {
  contractSnapshot: BillingContractSnapshot
  serviceSnapshots: BillingServiceSnapshot[]
  utilitySnapshots: BillingUtilitySnapshot[]
}

export interface BillingWorkspaceData {
  period: BillingPeriod
  run: BillingRun | null
  activeContracts: BillingWorkspaceContract[]
  meterReadings: BillingWorkspaceMeterReading[]
  warnings: BillingWorkspaceWarning[]
  buildingRates: {
    electricityRate: number
    waterRate: number
  }
}

export interface BillingWorkspaceContract {
  contractId: string
  roomId: string
  roomNumber: string
  floor: number
  tenantId: string
  tenantName: string
  monthlyRent: number
  surchargeAmount: number
  discountAmount: number
  paymentDay: number | null
  occupantCount: number
  services: {
    contractServiceId: string
    catalogId: string
    name: string
    pricingType: 'fixed' | 'per_person'
    amount: number
    quantity: number
    isEnabled: boolean
  }[]
}

export interface BillingWorkspaceMeterReading {
  roomId: string
  meterType: 'electricity' | 'water'
  existingReadingId: string | null
  oldReading: number | null
  newReading: number | null
  consumption: number | null
  isAdjusted: boolean
  adjustmentReason: string | null
}

export interface BillingWorkspaceWarning {
  roomId: string
  roomNumber: string
  type: 'missing_reading' | 'negative_consumption' | 'no_rate_configured' | 'zero_rent'
  meterType?: string
  value?: number
}

export interface BillingItemsSummary {
  totalRooms: number
  totalReceivable: number
  totalPaid: number
  totalUnpaid: number
  totalElectricity: number
  totalWater: number
}
