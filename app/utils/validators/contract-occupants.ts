import { z } from 'zod'

export const contractOccupantAddSchema = z.object({
  tenant_id: z.string().uuid('ID khách thuê không hợp lệ'),
  role: z.enum(['primary', 'roommate']).default('roommate'),
  move_in_date: z.string().min(1, 'Ngày vào ở là bắt buộc'),
  billing_counted: z.boolean().default(true),
})

export type ContractOccupantAddInput = z.infer<typeof contractOccupantAddSchema>

export const contractOccupantMoveOutSchema = z.object({
  move_out_date: z.string().min(1, 'Ngày rời đi là bắt buộc'),
})

export type ContractOccupantMoveOutInput = z.infer<typeof contractOccupantMoveOutSchema>
