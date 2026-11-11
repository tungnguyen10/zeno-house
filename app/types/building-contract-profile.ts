export interface BuildingContractProfile {
  buildingId: string
  lessorFullName: string | null
  lessorDateOfBirth: string | null
  lessorPermanentAddress: string | null
  lessorIdNumber: string | null
  lessorIdIssuedDate: string | null
  lessorIdIssuedPlace: string | null
  lessorPhone: string | null
  lessorIdentityMasked: boolean
  brandName: string | null
  defaultTermMonths: number | null
  defaultDepositMonths: number | null
  noticeDays: number | null
  depositRefundDays: number | null
  renewalMonths: number | null
  extraOccupantFee: number | null
  drillingFee: number | null
  fingerprintResetFee: number | null
  signedCopies: number
  copiesPerParty: number
  updatedAt: string
  updatedBy: string | null
}

export type ReadinessCode =
  | 'lessor.full_name' | 'lessor.date_of_birth' | 'lessor.permanent_address' | 'lessor.id_number'
  | 'lessor.id_issued_date' | 'lessor.id_issued_place' | 'lessor.phone'
  | 'contract.default_term_months' | 'contract.default_deposit_months'
  | 'terms.notice_days' | 'terms.deposit_refund_days' | 'terms.renewal_months'
  | 'terms.extra_occupant_fee' | 'terms.drilling_fee' | 'terms.fingerprint_reset_fee'
  | 'billing.schedule' | 'billing.electricity_rate' | 'billing.water_rate' | 'invoice_profile'

export interface ReadinessStatus {
  ready: boolean
  missing: ReadinessCode[]
}

export interface BuildingReadiness {
  contract: ReadinessStatus
  billing: ReadinessStatus
}
