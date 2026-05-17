export type ContractPaymentType = 'deposit' | 'prepaid_rent' | 'rent' | 'other'

export interface ContractPayment {
  id: string
  contractId: string
  tenantId: string | null
  paymentType: ContractPaymentType
  amount: number
  coveredPeriodStart: string | null
  coveredPeriodEnd: string | null
  paidAt: string
  paymentMethod: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}
