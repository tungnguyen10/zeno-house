export type AiConversationStatus = 'active' | 'completed' | 'expired'
export type AiMessageRole = 'user' | 'assistant'
export type AiActionPlanStatus =
  | 'pending'
  | 'executing'
  | 'succeeded'
  | 'cancelled'
  | 'expired'
  | 'stale'
  | 'failed'

export type AgentErrorCategory =
  | 'TOOL_VALIDATION'
  | 'TOOL_NOT_ALLOWED'
  | 'CONFIRMATION_REQUIRED'
  | 'ACTION_EXPIRED'
  | 'ACTION_NOT_EXECUTABLE'
  | 'IDEMPOTENCY_REPLAY'
  | 'OPTIMISTIC_LOCK_CONFLICT'
  | 'LOOP_LIMIT_EXCEEDED'
  | 'INTERNAL_TOOL_FAILURE'

export interface AgentErrorDetails {
  category: AgentErrorCategory
  toolName?: string
  actionPlanId?: string
  retryable: boolean
  conversationId?: string
  requestId?: string
  details?: unknown
}

export interface AiConversation {
  id: string
  userId: string
  status: AiConversationStatus
  title: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: string
  conversationId: string
  userId: string
  role: AiMessageRole
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AiActionPlan {
  id: string
  conversationId: string
  userId: string
  buildingId: string | null
  actionType: string
  title: string
  summary: string
  normalizedPayload: Record<string, unknown>
  payloadHash: string
  preview: Record<string, unknown>
  warnings: string[]
  resourceVersions: Record<string, string>
  idempotencyKey: string
  status: AiActionPlanStatus
  result: unknown
  error: unknown
  expiresAt: string
  confirmedAt: string | null
  executedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AiActionPlanDto {
  id: string
  conversationId: string
  actionType: string
  status: AiActionPlanStatus
  title: string
  summary: string
  buildingId: string | null
  preview: Record<string, unknown>
  warnings: string[]
  expiresAt: string
  result?: unknown
  error?: unknown
}

export interface AiConversationTranscript {
  conversation: AiConversation
  messages: AiMessage[]
  actionPlans: AiActionPlanDto[]
}

export interface AiBuildingSummary {
  id: string
  slug: string
  name: string
  address: string
  status: 'active' | 'inactive'
  updatedAt: string
}

export type AiBuildingResolution =
  | { status: 'resolved'; building: AiBuildingSummary }
  | { status: 'ambiguous'; candidates: AiBuildingSummary[] }
  | { status: 'not_found' }

export type AiMeterImportField = 'row' | 'room' | 'electricity' | 'water'

export interface AiMeterImportIssue {
  line: number
  field: AiMeterImportField
  code: string
  message: string
}

export interface AiMeterImportParsedRow {
  line: number
  roomReference: string
  electricity?: number
  water?: number
}

export interface AiMeterImportNormalizedReading {
  sourceLine: number
  roomId: string
  roomNumber: string
  meterType: 'electricity' | 'water'
  readingValue: number
  previousValue: number | null
  existingReadingId: string | null
  expectedUpdatedAt: string | null
}

export interface AiMeterImportPreview {
  building: AiBuildingSummary
  billingPeriodId: string | null
  billingPeriodUpdatedAt: string | null
  periodYear: number
  periodMonth: number
  readingDate: string
  rows: AiMeterImportNormalizedReading[]
  warnings: AiMeterImportIssue[]
  blockers: AiMeterImportIssue[]
}

export type AiBillingDraftNextStep =
  | 'correct_billing_inputs'
  | 'preview_invoice_issue'
  | 'review_existing_invoices'
  | 'no_billable_contracts'

export interface AiBillingDraftExplanation {
  periodId: string
  draftCount: number
  blockedDraftCount: number
  issuableDraftCount: number
  existingInvoiceCount: number
  draftTotal: number
  chargeTotals: Record<string, number>
  blockerGroups: Array<{ code: string; count: number; rooms: string[] }>
  warningGroups: Array<{ code: string; count: number; rooms: string[] }>
  nextStep: AiBillingDraftNextStep
}

export interface AiInvoiceIssuePreviewItem {
  contractId: string
  roomId: string
  tenantId: string
  totalAmount: number
  blockerCodes: string[]
  warningCodes: string[]
}

export interface AiInvoiceIssuePreview {
  periodId: string
  dueDate: string | null
  requestedContractIds: string[]
  issuable: AiInvoiceIssuePreviewItem[]
  blocked: AiInvoiceIssuePreviewItem[]
  alreadyIssued: AiInvoiceIssuePreviewItem[]
  issuableCount: number
  blockedCount: number
  alreadyIssuedCount: number
  totalAmount: number
  snapshotHash: string
}

export type AiStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-status'; tool: string; status: 'started' | 'succeeded' | 'failed'; durationMs?: number }
  | { type: 'action-plan'; plan: AiActionPlanDto }
  | { type: 'error'; error: { code: string; message: string; details?: unknown } }
  | { type: 'done'; conversationId: string; requestId: string; model: string }
