export type ContractAmendmentStatus = 'draft' | 'scheduled' | 'applied' | 'cancelled'

export interface ContractAmendmentChangeSet {
  monthlyRent?: number
  deposit?: number
  paymentDueDay?: number | null
  occupantCount?: number
  discountAmount?: number
  surchargeAmount?: number
}

export interface ContractTermSnapshot {
  monthlyRent: number
  deposit: number
  paymentDueDay: number | null
  occupantCount: number
  discountAmount: number
  surchargeAmount: number
}

export interface ContractAmendment {
  id: string
  contractId: string
  sequenceNo: number
  title: string
  publicContent: string
  effectiveDate: string
  status: ContractAmendmentStatus
  changes: ContractAmendmentChangeSet
  beforeTerms: ContractTermSnapshot | null
  afterTerms: ContractTermSnapshot | null
  createdBy: string | null
  publishedBy: string | null
  appliedBy: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  appliedAt: string | null
  cancelledAt: string | null
}

export type TenantContractAmendmentStatus = Extract<ContractAmendmentStatus, 'scheduled' | 'applied'>

export interface TenantContractAmendmentSummary {
  id: string
  sequenceNo: number
  title: string
  publicContent: string
  effectiveDate: string
  status: TenantContractAmendmentStatus
  changes: ContractAmendmentChangeSet
  beforeTerms: ContractTermSnapshot
  afterTerms: ContractTermSnapshot
}

export type PaymentDueDaySource = 'contract' | 'building' | 'unset'
