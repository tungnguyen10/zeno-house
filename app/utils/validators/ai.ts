import { z } from 'zod'
import { utilityUsageOverrideBaseSchema } from './billing'

export const aiChatRequestSchema = z.object({
  id: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(8000),
})

export const aiActionIdSchema = z.string().uuid()

export const aiActionPlanCreateSchema = z.object({
  conversation_id: z.string().uuid(),
  building_id: z.string().uuid().nullable().optional(),
  action_type: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
  normalized_payload: z.record(z.string(), z.unknown()),
  preview: z.record(z.string(), z.unknown()).default({}),
  warnings: z.array(z.string().max(500)).default([]),
  resource_versions: z.record(z.string(), z.string()).default({}),
  expires_in_seconds: z.number().int().min(30).max(3600).default(900),
})

export const aiToolGetMeterStatusSchema = z.object({
  building_ref: z.string().trim().min(1).max(200),
  period_year: z.number().int().min(2000).max(2100).optional(),
  period_month: z.number().int().min(1).max(12).optional(),
})

export const aiToolListBuildingsSchema = z.object({})

export const aiToolPlanOpenBillingPeriodSchema = z.object({
  building_ref: z.string().trim().min(1).max(200),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
})

export const aiToolPreviewMeterImportSchema = z.object({
  building_ref: z.string().trim().min(1).max(200),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
  reading_date: z.string().date(),
}).strict()

export const aiToolPlanMeterReadingUpdateSchema = z.object({
  reading_id: z.string().uuid(),
  reading_value: z.number().finite().min(0),
  reading_date: z.string().date().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
}).strict()

export const aiMeterImportPayloadSchema = z.object({
  building_id: z.string().uuid(),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
  reading_date: z.string().date(),
  readings: z.array(z.object({
    room_id: z.string().uuid(),
    meter_type: z.enum(['electricity', 'water']),
    reading_value: z.number().finite().min(0),
    expected_updated_at: z.string().datetime({ offset: true }).nullable(),
  }).strict()).min(1).max(500),
}).strict()

export const aiMeterReadingUpdatePayloadSchema = z.object({
  reading_id: z.string().uuid(),
  reading_value: z.number().finite().min(0),
  reading_date: z.string().date().optional(),
  notes: z.string().max(300).nullable().optional(),
  expected_updated_at: z.string().datetime({ offset: true }),
}).strict()

export const aiToolPlanUtilityUsageOverrideSchema = utilityUsageOverrideBaseSchema.omit({
  room_id: true,
  expected_updated_at: true,
}).extend({
  building_ref: z.string().trim().min(1).max(200),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
  room_ref: z.string().trim().min(1).max(200),
}).strict().refine(
  value => value.reason === 'normal' || Boolean(value.note?.trim()),
  { message: 'Cần ghi rõ lý do thay đổi/đính chính', path: ['note'] },
)

export const aiUtilityUsageOverridePayloadSchema = z.object({
  billing_period_id: z.string().uuid(),
  override: utilityUsageOverrideBaseSchema.extend({
    room_id: z.string().uuid(),
    expected_updated_at: z.string().datetime({ offset: true }).nullable(),
  }).strict().refine(
    value => value.reason === 'normal' || Boolean(value.note?.trim()),
    { message: 'Cần ghi rõ lý do thay đổi/đính chính', path: ['note'] },
  ),
}).strict()

export const aiOpenBillingPeriodPayloadSchema = z.object({
  building_id: z.string().uuid(),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
})

export const aiToolGetBillingPeriodOverviewSchema = z.object({
  period_id: z.string().uuid(),
})

export const aiToolCalculateBillingDraftSchema = z.object({
  period_id: z.string().uuid(),
}).strict()

export const aiToolPlanInvoiceIssueSchema = z.object({
  period_id: z.string().uuid(),
  contract_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
  due_date: z.string().date().nullable().optional(),
}).strict()

export const aiInvoiceIssuePayloadSchema = z.object({
  period_id: z.string().uuid(),
  contract_ids: z.array(z.string().uuid()).min(1).max(500),
  due_date: z.string().date().nullable(),
  snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

export const aiToolPlanVoidInvoiceSchema = z.object({
  invoice_ref: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(10).max(500),
}).strict()

export const aiVoidInvoicePayloadSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
  expected_updated_at: z.string().datetime({ offset: true }),
}).strict()

export const aiToolPlanReissueInvoiceSchema = z.object({
  invoice_ref: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(10).max(500),
  due_date: z.string().date().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).strict()

export const aiReissueInvoicePayloadSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
  due_date: z.string().date().nullable(),
  notes: z.string().max(500).nullable(),
  expected_updated_at: z.string().datetime({ offset: true }),
  snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
  correlation_id: z.string().uuid(),
}).strict()

export const aiToolPlanPaidInvoiceAdjustmentSchema = z.object({
  invoice_ref: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  amount: z.number().int().refine(value => value !== 0, 'Số tiền điều chỉnh phải khác 0'),
  reason: z.string().trim().min(1).max(500),
  reference_invoice_id: z.string().uuid().nullable().optional(),
}).strict()

export const aiPaidInvoiceAdjustmentPayloadSchema = z.object({
  invoice_id: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  amount: z.number().int().refine(value => value !== 0),
  reason: z.string().trim().min(1).max(500),
  reference_invoice_id: z.string().uuid().nullable(),
  expected_updated_at: z.string().datetime({ offset: true }),
}).strict()

export type AiChatRequestInput = z.infer<typeof aiChatRequestSchema>
export type AiActionPlanCreateInput = z.infer<typeof aiActionPlanCreateSchema>
export type AiToolPlanOpenBillingPeriodInput = z.infer<typeof aiToolPlanOpenBillingPeriodSchema>
export type AiToolPreviewMeterImportInput = z.infer<typeof aiToolPreviewMeterImportSchema>
export type AiToolPlanMeterReadingUpdateInput = z.infer<typeof aiToolPlanMeterReadingUpdateSchema>
export type AiMeterImportPayload = z.infer<typeof aiMeterImportPayloadSchema>
export type AiMeterReadingUpdatePayload = z.infer<typeof aiMeterReadingUpdatePayloadSchema>
export type AiToolPlanUtilityUsageOverrideInput = z.infer<typeof aiToolPlanUtilityUsageOverrideSchema>
export type AiUtilityUsageOverridePayload = z.infer<typeof aiUtilityUsageOverridePayloadSchema>
export type AiToolPlanInvoiceIssueInput = z.infer<typeof aiToolPlanInvoiceIssueSchema>
export type AiInvoiceIssuePayload = z.infer<typeof aiInvoiceIssuePayloadSchema>
export type AiToolPlanVoidInvoiceInput = z.infer<typeof aiToolPlanVoidInvoiceSchema>
export type AiVoidInvoicePayload = z.infer<typeof aiVoidInvoicePayloadSchema>
export type AiToolPlanReissueInvoiceInput = z.infer<typeof aiToolPlanReissueInvoiceSchema>
export type AiReissueInvoicePayload = z.infer<typeof aiReissueInvoicePayloadSchema>
export type AiToolPlanPaidInvoiceAdjustmentInput = z.infer<typeof aiToolPlanPaidInvoiceAdjustmentSchema>
export type AiPaidInvoiceAdjustmentPayload = z.infer<typeof aiPaidInvoiceAdjustmentPayloadSchema>
