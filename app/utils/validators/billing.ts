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
  building_id: z.string().uuid().optional(),
  period_year: z.coerce.number().int().min(2000).max(2100).optional(),
  period_month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(BILLING_PERIOD_STATUSES).optional(),
  has_debt: z.coerce.boolean().optional(),
})
export type BillingPeriodListQuery = z.infer<typeof billingPeriodListQuerySchema>

export const billingPeriodOpenSchema = z.object({
  building_id: z.string().uuid(),
  period_year: z.coerce.number().int().min(2000).max(2100),
  period_month: z.coerce.number().int().min(1).max(12),
})
export type BillingPeriodOpenInput = z.infer<typeof billingPeriodOpenSchema>

export const billingPeriodUnissueSchema = z.object({
  reason: z.string().min(1).max(500),
})
export type BillingPeriodUnissueInput = z.infer<typeof billingPeriodUnissueSchema>

// ---------------------------------------------------------------------------
// Utility usage override
// ---------------------------------------------------------------------------

export const utilityUsageOverrideSchema = z
  .object({
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
  })
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
// Issue invoices
// ---------------------------------------------------------------------------

export const issueInvoicesSchema = z.object({
  contract_ids: z.array(z.string().uuid()).optional(),
  due_date: z.string().nullable().optional(),
})
export type IssueInvoicesInput = z.infer<typeof issueInvoicesSchema>

// ---------------------------------------------------------------------------
// Void invoice
// ---------------------------------------------------------------------------

export const voidInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cần nhập lý do huỷ').max(500),
})
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>

// ---------------------------------------------------------------------------
// Reissue invoice (after void)
// ---------------------------------------------------------------------------

export const reissueInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cần nhập lý do phát hành lại').max(500),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})
export type ReissueInvoiceInput = z.infer<typeof reissueInvoiceSchema>

// ---------------------------------------------------------------------------
// Adjustment charge
// ---------------------------------------------------------------------------

export const adjustmentChargeSchema = z.object({
  target_invoice_id: z.string().uuid(),
  label: z.string().min(1).max(200),
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
  reference_invoice_id: z.string().uuid().nullable().optional(),
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
