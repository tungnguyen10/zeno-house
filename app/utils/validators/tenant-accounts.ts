import { z } from 'zod'

export const tenantAccountProvisionSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
})

export const tenantAccountStatusUpdateSchema = z.object({
  status: z.enum(['active', 'disabled']),
})

export type TenantAccountProvisionInput = z.infer<typeof tenantAccountProvisionSchema>
export type TenantAccountStatusUpdateInput = z.infer<typeof tenantAccountStatusUpdateSchema>
