import { z } from 'zod'

export const assignSchema = z.object({
  room_id: z.string().uuid('Room không hợp lệ'),
  tenant_id: z.string().uuid('Tenant không hợp lệ'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu không hợp lệ (YYYY-MM-DD)'),
  notes: z.string().max(500, 'Ghi chú quá dài').nullable().optional(),
})

export type AssignInput = z.infer<typeof assignSchema>
