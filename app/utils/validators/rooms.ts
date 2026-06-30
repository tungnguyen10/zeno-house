import { z } from 'zod'

export const roomStatusSchema = z.enum(['available', 'occupied', 'maintenance', 'archived'])
export const roomSortFieldSchema = z.enum(['room_number', 'floor', 'monthly_rent', 'created_at'])
export const roomSortOrderSchema = z.enum(['asc', 'desc'])

const toArray = <T>(value: T | T[] | undefined): T[] | undefined => {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value : [value]
}

export const roomCreateSchema = z.object({
  building_id: z.string().uuid('Building không hợp lệ'),
  room_number: z.string().min(1, 'Số phòng không được trống').max(20, 'Số phòng quá dài'),
  floor: z.number().int().min(1, 'Tầng phải >= 1').max(100, 'Tầng phải <= 100'),
  status: roomStatusSchema.optional().default('available'),
  monthly_rent: z.number().min(0, 'Giá thuê không được âm'),
  area: z.number().positive('Diện tích phải > 0').nullable().optional(),
  description: z.string().max(500, 'Mô tả quá dài').nullable().optional(),
})

export const roomUpdateSchema = roomCreateSchema.partial().omit({ building_id: true })

export const roomListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).max(100).optional(),
  ),
  building_id: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
  floor: z.preprocess(
    v => (v === '' || v === undefined ? undefined : v),
    z.coerce.number().int().min(1).max(100).optional(),
  ),
  status: z.preprocess(toArray, z.array(roomStatusSchema).min(1).optional()),
  sort: roomSortFieldSchema.optional().default('floor'),
  order: roomSortOrderSchema.optional().default('asc'),
})

export const roomBulkActionSchema = z.object({
  action: z.enum(['archive', 'activate', 'set_maintenance', 'delete']),
  ids: z.array(z.string().min(1)).min(1, 'Cần chọn ít nhất một phòng'),
  reason: z.string().trim().min(1, 'Lý do xoá là bắt buộc').max(500, 'Lý do quá dài').optional(),
}).refine(
  data => data.action !== 'delete' || Boolean(data.reason),
  { message: 'Lý do xoá là bắt buộc', path: ['reason'] },
)

export const roomDeleteSchema = z.object({
  reason: z.string().trim().min(1, 'Lý do xoá là bắt buộc').max(500, 'Lý do quá dài'),
})

export type RoomCreateInput = z.infer<typeof roomCreateSchema>
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>
export type RoomListQuery = z.infer<typeof roomListQuerySchema>
export type RoomBulkActionInput = z.infer<typeof roomBulkActionSchema>
export type RoomDeleteInput = z.infer<typeof roomDeleteSchema>
