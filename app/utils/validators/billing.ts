import { z } from 'zod'
import {
  BILLING_PERIOD_STATUSES,
  CHARGE_TYPES,
  METER_TYPES,
  UTILITY_USAGE_REASONS,
} from '~/utils/constants/billing'

// ---------------------------------------------------------------------------
// Period queries
// ---------------------------------------------------------------------------

export const billingPeriodListQuerySchema = z.object({
  building_id: z.string().min(1).optional(),
  period_year: z.coerce.number().int().min(2000).max(2100).optional(),
  period_month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(BILLING_PERIOD_STATUSES).optional(),
  has_debt: z.coerce.boolean().optional(),
})
export type BillingPeriodListQuery = z.infer<typeof billingPeriodListQuerySchema>

export const billingPeriodOpenSchema = z.object({
  building_id: z.string().min(1),
  period_year: z.coerce.number().int().min(2000).max(2100),
  period_month: z.coerce.number().int().min(1).max(12),
})
export type BillingPeriodOpenInput = z.infer<typeof billingPeriodOpenSchema>

export const billingPeriodUnissueSchema = z.object({
  reason: z.string().min(1).max(500),
})
export type BillingPeriodUnissueInput = z.infer<typeof billingPeriodUnissueSchema>

export const billingPeriodReopenSchema = z.object({
  reason: z.string().min(1).max(500),
})
export type BillingPeriodReopenInput = z.infer<typeof billingPeriodReopenSchema>

// ---------------------------------------------------------------------------
// Utility usage override
// ---------------------------------------------------------------------------

export const utilityUsageOverrideBaseSchema = z.object({
    room_id: z.string().uuid(),
    meter_type: z.enum(METER_TYPES),
    previous_reading_id: z.string().uuid().nullable().optional(),
    previous_reading_value: z.number().min(0),
    current_reading_id: z.string().uuid().nullable().optional(),
    current_reading_value: z.number().min(0),
    old_meter_final_value: z.number().min(0).nullable().optional(),
    new_meter_start_value: z.number().min(0).nullable().optional(),
    billable_usage: z.number().min(0),
    reason: z.enum(UTILITY_USAGE_REASONS),
    note: z.string().max(500).nullable().optional(),
    expected_updated_at: z.string().datetime({ offset: true }).nullable().optional(),
  })

export const utilityUsageOverrideSchema = utilityUsageOverrideBaseSchema
  .refine(
    v =>
      v.reason !== 'normal' || v.note === null || v.note === undefined || v.note.length >= 0,
    { message: 'Lý do không hợp lệ' },
  )
  .refine(
    v => v.reason === 'normal' || (v.note && v.note.trim().length > 0),
    { message: 'Cần ghi rõ lý do thay đổi/đính chính', path: ['note'] },
  )
export type UtilityUsageOverrideInput = z.infer<typeof utilityUsageOverrideSchema>

// ---------------------------------------------------------------------------
// Period-scoped incidental charges
// ---------------------------------------------------------------------------

const incidentalChargeLabelSchema = z.string().trim().min(1, 'Cần nhập tên khoản phát sinh').max(200)
const incidentalChargeAmountSchema = z.number().int().positive().max(999_999_999_999)
const incidentalChargeNoteSchema = z.string().trim().max(500).nullable().optional()

export const incidentalChargeCreateSchema = z.object({
  contract_id: z.string().uuid(),
  label: incidentalChargeLabelSchema,
  amount: incidentalChargeAmountSchema,
  note: incidentalChargeNoteSchema,
  operation_id: z.string().uuid(),
}).strict()
export type IncidentalChargeCreateInput = z.infer<typeof incidentalChargeCreateSchema>

export const incidentalChargeUpdateSchema = z.object({
  label: incidentalChargeLabelSchema.optional(),
  amount: incidentalChargeAmountSchema.optional(),
  note: incidentalChargeNoteSchema,
  expected_updated_at: z.string().datetime({ offset: true }),
}).strict().refine(
  value => value.label !== undefined || value.amount !== undefined || value.note !== undefined,
  { message: 'Cần ít nhất một thay đổi' },
)
export type IncidentalChargeUpdateInput = z.infer<typeof incidentalChargeUpdateSchema>

export const incidentalChargeDeleteSchema = z.object({
  expected_updated_at: z.string().datetime({ offset: true }),
}).strict()
export type IncidentalChargeDeleteInput = z.infer<typeof incidentalChargeDeleteSchema>

// ---------------------------------------------------------------------------
// Issue invoices
// ---------------------------------------------------------------------------

const issueInvoiceSelectionSchema = z.object({
  contract_ids: z.array(z.string().uuid()).min(1).max(100),
  due_date: z.iso.date(),
})

export const issueInvoicesPreviewSchema = issueInvoiceSelectionSchema.strict()
export type IssueInvoicesPreviewInput = z.infer<typeof issueInvoicesPreviewSchema>

export const issueInvoicesSchema = issueInvoiceSelectionSchema.extend({
  snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
  operation_id: z.string().uuid(),
}).strict()
export type IssueInvoicesInput = z.infer<typeof issueInvoicesSchema>

/** Internal server-owned payload after preview validation; also shared by the existing AI flow. */
export interface IssueInvoicesCommitInput {
  contract_ids?: string[]
  due_date?: string | null
}

// ---------------------------------------------------------------------------
// Void invoice
// ---------------------------------------------------------------------------

export const voidInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cần nhập lý do huỷ').max(500),
  expected_updated_at: z.string().datetime({ offset: true }),
})
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>

// ---------------------------------------------------------------------------
// Reissue invoice (after void)
// ---------------------------------------------------------------------------

export const reissueInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cần nhập lý do phát hành lại').max(500),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  expected_updated_at: z.string().datetime({ offset: true }),
})
export type ReissueInvoiceInput = z.infer<typeof reissueInvoiceSchema>

// ---------------------------------------------------------------------------
// Adjustment charge
// ---------------------------------------------------------------------------

export const adjustmentChargeSchema = z.object({
  target_invoice_id: z.string().min(1),
  label: z.string().min(1).max(200),
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
  reference_invoice_id: z.string().uuid().nullable().optional(),
  expected_updated_at: z.string().datetime({ offset: true }),
})
export type AdjustmentChargeInput = z.infer<typeof adjustmentChargeSchema>

// ---------------------------------------------------------------------------
// Invoice payment
// ---------------------------------------------------------------------------

export const invoicePaymentCreateSchema = z.object({
  amount: z.number().int().positive(),
  paid_at: z.string(),
  payment_method: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})
export type InvoicePaymentCreateInput = z.infer<typeof invoicePaymentCreateSchema>

// ---------------------------------------------------------------------------
// Bulk invoice payments
// ---------------------------------------------------------------------------

export const bulkPaymentItemSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().int().positive(),
  payment_method: z.string().max(100).nullable().optional(),
  payment_date: z.string().min(1, 'Cần ngày thanh toán'),
  reference: z.string().max(200).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})
export type BulkPaymentItemInput = z.infer<typeof bulkPaymentItemSchema>

export const bulkPaymentsBodySchema = z.object({
  payments: z.array(bulkPaymentItemSchema).min(1, 'Cần ít nhất 1 dòng thanh toán'),
})
export type BulkPaymentsBodyInput = z.infer<typeof bulkPaymentsBodySchema>

// ---------------------------------------------------------------------------
// Charge schema (used for draft → issue mapping; not directly exposed)
// ---------------------------------------------------------------------------

export const chargeSchema = z.object({
  charge_type: z.enum(CHARGE_TYPES),
  label: z.string().min(1).max(200),
  source_type: z.string().nullable().optional(),
  source_id: z.string().uuid().nullable().optional(),
  quantity: z.number().min(0),
  unit_price: z.number().int(),
  amount: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sort_order: z.number().int().default(0),
})
export type ChargeInput = z.infer<typeof chargeSchema>
