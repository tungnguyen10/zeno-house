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
import type { InvoiceProfileDisplay } from '~/types/building-invoice-profile'

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

export interface BillingPeriodOpenResult {
  period: BillingPeriod
  created: boolean
}

export interface BillingWorkspaceBootstrap {
  period: BillingPeriod
  grid: BillingDraftGridResponse | null
  utilityUsages: BillingUtilityUsage[]
  overview: BillingWorkspaceOverview | null
  invoices: Invoice[]
  drafts: BillingDraftResponse | null
}

export interface Invoice {
  id: string
  invoiceCode: string
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
  tenantName?: string | null
  roomNumber?: string | null
  contractCode?: string | null
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
  recordedByName?: string | null
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
  approvedBy: string | null
  approvedAt: string | null
}

export interface BillingAuditEvent {
  id: string
  billingPeriodId: string | null
  actorId: string | null
  action: string
  entityType: BillingAuditEntityType
  entityId: string | null
  correlationId: string | null
  beforeData: unknown
  afterData: unknown
  metadata: Record<string, unknown>
  createdAt: string
  actorName?: string | null
  actorEmail?: string | null
  entityLabel?: string | null
  entitySubLabel?: string | null
  entityHref?: string | null
  summary?: string
}

// ---------------------------------------------------------------------------
// List/overview/draft DTOs
// ---------------------------------------------------------------------------

export interface BillingPeriodSummary {
  period: BillingPeriod
  buildingId: string
  buildingSlug?: string | null
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
  buildingIds?: string[] | null
  period_year?: number
  period_month?: number
  status?: BillingPeriodStatus
  has_debt?: boolean
}

export interface BillingWorkspaceOverview {
  period: BillingPeriod
  buildingId: string
  buildingSlug?: string | null
  buildingName: string | null
  contractCount: number
  invoiceCount: number
  readingCompleteCount: number
  readingRequiredCount: number
  draftTotal: number
  issuedTotal: number
  paidTotal: number
  outstandingBalance: number
  auditEvents: BillingAuditEvent[]
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

export interface BillingExistingInvoiceContext {
  id: string
  totalAmount: number
  paidAmount: number
  status: InvoiceStatus
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
  existingInvoice?: BillingExistingInvoiceContext | null
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
  invoiceProfile: InvoiceProfileDisplay | null
}

export interface InvoicePrintItem {
  invoice: Invoice
  charges: InvoiceCharge[]
  invoiceProfile: InvoiceProfileDisplay | null
  period: BillingPeriod
  building: {
    id: string
    name: string
    address: string
  }
}

// ---------------------------------------------------------------------------
// Draft Grid read model (combines reading entry + draft review into one room
// centered grid). Composed at the service boundary; not a new repository.
// ---------------------------------------------------------------------------

export type BillingDraftGridRowType = 'billable_contract' | 'vacant_baseline' | 'data_warning'

export type BillingDraftGridRowStatus =
  | 'missing_reading'
  | 'blocked'
  | 'warning'
  | 'ready'
  | 'issued'
  | 'partial'
  | 'paid'
  | 'baseline'

export type BillingDraftGridUtilitySource =
  | 'monthly'
  | 'handover_fallback'
  | 'override'
  | 'fixed'
  | 'per_person'
  | 'not_applicable'

export interface BillingDraftGridUtilityCell {
  meterType: MeterType
  required: boolean
  editable: boolean
  previousReadingId: string | null
  previousValue: number | null
  currentReadingId: string | null
  currentValue: number | null
  readingDate: string | null
  usage: number | null
  rate: number | null
  amount: number | null
  pricingType: string | null
  overrideId: string | null
  source: BillingDraftGridUtilitySource
  blockerCode: BillingBlockerCode | null
}

export interface BillingDraftGridRow {
  key: string
  rowType: BillingDraftGridRowType
  roomId: string
  roomNumber: string | null
  floor: number | null
  contractId: string | null
  tenantId: string | null
  tenantName: string | null
  contractCode: string | null
  invoiceId: string | null
  invoiceStatus: InvoiceStatus | null
  existingInvoice?: BillingExistingInvoiceContext | null
  editable: boolean
  status: BillingDraftGridRowStatus
  electricity: BillingDraftGridUtilityCell | null
  water: BillingDraftGridUtilityCell | null
  rentAndServiceTotal: number
  draftTotal: number | null
  blockers: BillingDraftBlocker[]
  warnings: BillingDraftWarning[]
  lines: BillingDraftLine[]
}

export interface BillingDraftGridResponse {
  period: BillingPeriod
  batchReadingDate: string
  rows: BillingDraftGridRow[]
  totals: {
    requiredReadingCount: number
    completeReadingCount: number
    readyDraftCount: number
    blockedDraftCount: number
    draftTotal: number
  }
  overview: BillingWorkspaceOverview
}
