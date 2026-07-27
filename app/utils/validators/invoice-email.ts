import { z } from 'zod'

export const invoiceEmailSettingsUpdateSchema = z.object({
  auto_send_enabled: z.boolean(),
}).strict()

export type InvoiceEmailSettingsUpdateInput =
  z.infer<typeof invoiceEmailSettingsUpdateSchema>

export const invoiceEmailEnqueueSchema = z.object({
  invoice_ids: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
}).strict()

export type InvoiceEmailEnqueueInput = z.infer<typeof invoiceEmailEnqueueSchema>

export const invoiceEmailResendSchema = z.object({
  confirm_duplicate: z.boolean().default(false),
}).strict()

export type InvoiceEmailResendInput = z.infer<typeof invoiceEmailResendSchema>
