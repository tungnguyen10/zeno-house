import { z } from 'zod'

export const contractStatusSchema = z.enum(['active', 'expired', 'terminated', 'renewed'])
export const contractSortFieldSchema = z.enum(['start_date', 'end_date', 'created_at', 'monthly_rent'])
export const contractSortOrderSchema = z.enum(['asc', 'desc'])

const toArray = <T>(value: T | T[] | undefined): T[] | undefined => {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value : [value]
}

export const contractListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
  q: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).max(100).optional(),
  ),
  building_id: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
  room_id: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
  tenant_id: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
  status: z.preprocess(toArray, z.array(contractStatusSchema).min(1).optional()),
  sort: contractSortFieldSchema.optional().default('created_at'),
  order: contractSortOrderSchema.optional().default('desc'),
})

export type ContractListQuery = z.infer<typeof contractListQuerySchema>

export const contractBulkActionSchema = z.object({
  action: z.enum(['terminate', 'delete']),
  ids: z.array(z.string().min(1)).min(1, 'Chọn ít nhất một hợp đồng'),
  reason: z.string().trim().max(500, 'Lý do quá dài').optional(),
}).refine(
  data => data.action !== 'delete' || Boolean(data.reason?.trim()),
  { message: 'Lý do xoá là bắt buộc', path: ['reason'] },
)

export type ContractBulkActionInput = z.infer<typeof contractBulkActionSchema>

export const contractDeleteSchema = z.object({
  reason: z.string().trim().min(1, 'Lý do xoá là bắt buộc').max(500, 'Lý do quá dài'),
})

export type ContractDeleteInput = z.infer<typeof contractDeleteSchema>

export const contractCreateSchema = z.object({
  room_id: z.string().uuid('ID phòng không hợp lệ'),
  tenant_id: z.string().uuid('ID khách thuê không hợp lệ'),
  building_id: z.string().uuid('ID tòa nhà không hợp lệ').nullable().optional(),
  start_date: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  end_date: z.string().min(1, 'Ngày kết thúc là bắt buộc'),
  monthly_rent: z.number().min(0, 'Giá thuê không được âm'),
  deposit: z.number().min(0, 'Đặt cọc không được âm').optional().default(0),
  payment_day: z.number().int().min(1).max(31).nullable().optional(),
  occupant_count: z.number().int().min(1, 'Số người ở ít nhất là 1').optional().default(1),
  discount_amount: z.number().min(0, 'Giảm giá không được âm').optional().default(0),
  surcharge_amount: z.number().min(0, 'Phụ thu không được âm').optional().default(0),
  status: z.enum(['active', 'expired', 'terminated']).optional().default('active'),
  notes: z.string().max(500, 'Ghi chú quá dài').nullable().optional(),
  handover_electricity_reading: z.number().min(0, 'Số điện không được âm'),
  handover_water_reading: z.number().min(0, 'Số nước không được âm'),
  handover_reading_date: z.string().min(1).optional(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['end_date'] },
)

export const contractUpdateSchema = z.object({
  room_id: z.string().uuid('ID phòng không hợp lệ').optional(),
  tenant_id: z.string().uuid('ID khách thuê không hợp lệ').optional(),
  building_id: z.string().uuid('ID tòa nhà không hợp lệ').nullable().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  monthly_rent: z.number().min(0, 'Giá thuê không được âm').optional(),
  deposit: z.number().min(0, 'Đặt cọc không được âm').optional(),
  payment_day: z.number().int().min(1).max(31).nullable().optional(),
  occupant_count: z.number().int().min(1).optional(),
  discount_amount: z.number().min(0).optional(),
  surcharge_amount: z.number().min(0).optional(),
  status: z.enum(['active', 'expired', 'terminated']).optional(),
  notes: z.string().max(500, 'Ghi chú quá dài').nullable().optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) > new Date(data.start_date)
    }
    return true
  },
  { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['end_date'] },
)

export type ContractCreateInput = z.infer<typeof contractCreateSchema>
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>
