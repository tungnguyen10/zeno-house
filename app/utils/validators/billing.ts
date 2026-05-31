import { z } from 'zod'

export const billingPeriodCreateSchema = z.object({
  building_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})

export const billingPeriodUpdateSchema = z.object({
  action: z.enum(['finalize', 'unlock']),
})

export const billingGenerateSchema = z.object({
  building_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})

export const billingPreviewSchema = z.object({
  building_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})

export const billingBulkPaymentSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum(['paid', 'unpaid']),
  paid_by: z.string().uuid().optional(),
  payment_method: z.enum(['cash', 'bank_transfer', 'other']).nullable().optional(),
  payment_note: z.string().max(500).nullable().optional(),
})

export type BillingPeriodCreateInput = z.infer<typeof billingPeriodCreateSchema>
export type BillingPeriodUpdateInput = z.infer<typeof billingPeriodUpdateSchema>
export type BillingGenerateInput = z.infer<typeof billingGenerateSchema>
export type BillingPreviewInput = z.infer<typeof billingPreviewSchema>
export type BillingBulkPaymentInput = z.infer<typeof billingBulkPaymentSchema>
