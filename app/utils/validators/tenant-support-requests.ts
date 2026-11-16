import { z } from 'zod'

export const tenantSupportRequestQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['new', 'in_progress', 'resolved']).optional(),
}).strict()
export const tenantSupportRequestStatusUpdateSchema = z.object({
  status: z.enum(['in_progress', 'resolved']),
  expected_status: z.enum(['new', 'in_progress', 'resolved']),
}).strict()
export type TenantSupportRequestQueueQuery = z.infer<typeof tenantSupportRequestQueueQuerySchema>
export type TenantSupportRequestStatusUpdate = z.infer<typeof tenantSupportRequestStatusUpdateSchema>
