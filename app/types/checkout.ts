export type CheckoutFinancialStatus = 'unsettled' | 'awaiting_payment' | 'awaiting_refund' | 'settled'

export interface CheckoutMeterInput {
  reading: number
  usageOverride?: number | null
  reason?: string | null
}

export interface CheckoutDraftInput {
  actual_return_date: string
  reason: string
  electricity?: CheckoutMeterInput | null
  water?: CheckoutMeterInput | null
  expected_updated_at?: string | null
}

export interface CheckoutRecord {
  id: string
  contractId: string
  buildingId: string
  actualReturnDate: string
  reason: string
  status: 'draft' | 'returned'
  electricity: CheckoutMeterInput | null
  water: CheckoutMeterInput | null
  updatedAt: string
}

export interface CheckoutCharge {
  key: string
  chargeType: 'electricity' | 'water' | 'incidental'
  label: string
  amount: number
  quantity: number
  unitPrice: number
  metadata: Record<string, unknown>
}

export interface CheckoutInvoiceBalance {
  id: string
  code: string | null
  dueDate: string
  balance: number
}

export interface CheckoutPreview {
  snapshotHash: string
  depositHeld: number
  creditHeld: number
  existingDebt: number
  finalChargesTotal: number
  totalDue: number
  refundDue: number
  additionalDue: number
  depositApplied: number
  creditApplied: number
  charges: CheckoutCharge[]
  invoices: CheckoutInvoiceBalance[]
  blockers: string[]
}

export interface CheckoutStatement {
  id: string
  code: string
  confirmedAt: string
  confirmedBy: string
  preview: CheckoutPreview
  refundedAmount: number
  remainingRefund: number
  outstandingDebt: number
  financialStatus: CheckoutFinancialStatus
}

export interface CheckoutRefund {
  id: string
  amount: number
  paidAt: string
  paymentMethod: string
  note: string | null
}

export interface CheckoutSource {
  id: string
  paymentType: string
  amount: number
  approvedAmount: number
}

export interface CheckoutBundle {
  enabled: boolean
  checkout: CheckoutRecord | null
  depositHeld: number
  creditHeld: number
  statement: CheckoutStatement | null
  refunds: CheckoutRefund[]
  sources: CheckoutSource[]
  invoices?: CheckoutInvoiceBalance[]
}
