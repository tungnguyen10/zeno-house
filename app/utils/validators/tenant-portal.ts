import { z } from 'zod'

export const tenantProfileUpdateSchema = z.object({
  phone: z.string().trim().min(1).max(20).optional(),
  email: z.string().trim().email().nullable().optional(),
  emergency_contact_name: z.string().trim().max(100).nullable().optional(),
  emergency_contact_phone: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine(input => Object.keys(input).length > 0, {
  message: 'Cần ít nhất một trường hồ sơ hợp lệ',
})

export const tenantInvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})

export type TenantProfileUpdateInput = z.infer<typeof tenantProfileUpdateSchema>
export type TenantInvoiceListQuery = z.infer<typeof tenantInvoiceListQuerySchema>
