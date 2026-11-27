import { z } from 'zod'

export const tenantSupportRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const tenantSupportRequestQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['new', 'in_progress', 'resolved']).optional(),
}).strict()
export const tenantSupportRequestStatusUpdateSchema = z.object({
  status: z.enum(['in_progress', 'resolved']),
  expected_status: z.enum(['new', 'in_progress', 'resolved']),
  expected_updated_at: z.iso.datetime({ offset: true }),
  public_response: z.string().trim().min(1).max(4000).optional(),
}).strict()
export type TenantSupportRequestListQuery = z.infer<typeof tenantSupportRequestListQuerySchema>
export type TenantSupportRequestQueueQuery = z.infer<typeof tenantSupportRequestQueueQuerySchema>
export type TenantSupportRequestStatusUpdate = z.infer<typeof tenantSupportRequestStatusUpdateSchema>
