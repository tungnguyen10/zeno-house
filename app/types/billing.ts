import type {
  BillingPeriodStatus,
  InvoiceStatus,
  ChargeType,
  MeterType,
  UtilityUsageReason,
  BillingAuditEntityType,
  BillingBlockerCode,
  BillingWarningCode,
} from '~/utils/constants/billing'

// ---------------------------------------------------------------------------
// Domain DTOs (camelCase, front-end facing)
// ---------------------------------------------------------------------------

export interface BillingPeriod {
  id: string
  buildingId: string
  periodYear: number
  periodMonth: number
  status: BillingPeriodStatus
  openedBy: string | null
  issuedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  billingPeriodId: string
  contractId: string
  roomId: string
  tenantId: string
  status: InvoiceStatus
  dueDate: string | null
  issuedAt: string | null
  paidAt: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  supersededByInvoiceId: string | null
  supersedesInvoiceId: string | null
  subtotalAmount: number
  discountAmount: number
  surchargeAmount: number
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceCharge {
  id: string
  invoiceId: string
  chargeType: ChargeType
  label: string
  sourceType: string | null
  sourceId: string | null
  quantity: number
  unitPrice: number
  amount: number
  metadata: Record<string, unknown>
  sortOrder: number
  createdAt: string
}

export interface InvoicePayment {
  id: string
  invoiceId: string
  amount: number
  paidAt: string
  paymentMethod: string | null
  note: string | null
  recordedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BillingUtilityUsage {
  id: string
  billingPeriodId: string
  roomId: string
  meterType: MeterType
  previousReadingId: string | null
  previousReadingValue: number
  currentReadingId: string | null
  currentReadingValue: number
  oldMeterFinalValue: number | null
  newMeterStartValue: number | null
  billableUsage: number
  reason: UtilityUsageReason
  note: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BillingAuditEvent {
  id: string
  billingPeriodId: string | null
  actorId: string | null
  action: string
  entityType: BillingAuditEntityType
  entityId: string | null
  beforeData: unknown
  afterData: unknown
  metadata: Record<string, unknown>
  createdAt: string
}

// ---------------------------------------------------------------------------
// List/overview/draft DTOs
// ---------------------------------------------------------------------------

export interface BillingPeriodSummary {
  period: BillingPeriod
  buildingId: string
  buildingName: string | null
  contractCount: number
  invoiceCount: number
  readingCompleteCount: number
  readingRequiredCount: number
  issuedTotal: number
  paidTotal: number
  outstandingBalance: number
}

export interface BillingPeriodListFilters {
  building_id?: string
  period_year?: number
  period_month?: number
  status?: BillingPeriodStatus
  has_debt?: boolean
}

export interface BillingWorkspaceOverview {
  period: BillingPeriod
  buildingId: string
  buildingName: string | null
  contractCount: number
  invoiceCount: number
  readingCompleteCount: number
  readingRequiredCount: number
  draftTotal: number
  issuedTotal: number
  paidTotal: number
  outstandingBalance: number
}

export interface BillingDraftBlocker {
  code: BillingBlockerCode
  message: string
  meta?: Record<string, unknown>
}

export interface BillingDraftWarning {
  code: BillingWarningCode
  message: string
  meta?: Record<string, unknown>
}

export interface BillingDraftLine {
  chargeType: ChargeType
  label: string
  sourceType: string | null
  sourceId: string | null
  quantity: number
  unitPrice: number
  amount: number
  metadata: Record<string, unknown>
  sortOrder: number
}

export interface BillingDraftInvoice {
  contractId: string
  roomId: string
  tenantId: string
  contractCode: string | null
  roomNumber: string | null
  tenantName: string | null
  lines: BillingDraftLine[]
  subtotalAmount: number
  discountAmount: number
  surchargeAmount: number
  totalAmount: number
  blockers: BillingDraftBlocker[]
  warnings: BillingDraftWarning[]
  existingInvoiceId: string | null
  existingInvoiceStatus: InvoiceStatus | null
}

export interface BillingDraftResponse {
  period: BillingPeriod
  drafts: BillingDraftInvoice[]
  totals: {
    draftTotal: number
    blockedDraftCount: number
    issuableDraftCount: number
  }
}

// ---------------------------------------------------------------------------
// Issue / void / reissue / adjustment / payment input shapes (DTOs the API
// returns; validators define the wire-level Zod inputs).
// ---------------------------------------------------------------------------

export interface IssueInvoicesResult {
  issuedCount: number
  invoices: Invoice[]
}

export interface InvoiceWithCharges {
  invoice: Invoice
  charges: InvoiceCharge[]
  payments: InvoicePayment[]
}
