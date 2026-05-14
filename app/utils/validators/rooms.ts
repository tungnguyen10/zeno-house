import { z } from 'zod'

export const roomCreateSchema = z.object({
  building_id: z.string().uuid('Building không hợp lệ'),
  room_number: z.string().min(1, 'Số phòng không được trống').max(20, 'Số phòng quá dài'),
  floor: z.number().int().min(1, 'Tầng phải >= 1').max(100, 'Tầng phải <= 100'),
  status: z.enum(['available', 'occupied', 'maintenance']).optional().default('available'),
  monthly_rent: z.number().min(0, 'Giá thuê không được âm'),
  area: z.number().positive('Diện tích phải > 0').nullable().optional(),
  description: z.string().max(500, 'Mô tả quá dài').nullable().optional(),
})

export const roomUpdateSchema = roomCreateSchema.partial().omit({ building_id: true })

export type RoomCreateInput = z.infer<typeof roomCreateSchema>
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>
