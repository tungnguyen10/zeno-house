import { z } from 'zod'

export const contractCreateSchema = z.object({
  room_id: z.string().uuid('ID phòng không hợp lệ'),
  tenant_id: z.string().uuid('ID khách thuê không hợp lệ'),
  building_id: z.string().uuid('ID tòa nhà không hợp lệ').nullable().optional(),
  start_date: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  end_date: z.string().min(1, 'Ngày kết thúc là bắt buộc'),
  monthly_rent: z.number().min(0, 'Giá thuê không được âm'),
  deposit: z.number().min(0, 'Đặt cọc không được âm').optional().default(0),
  occupant_count: z.number().int().min(1, 'Số người ở ít nhất là 1').optional().default(1),
  discount_amount: z.number().min(0, 'Giảm giá không được âm').optional().default(0),
  surcharge_amount: z.number().min(0, 'Phụ thu không được âm').optional().default(0),
  status: z.enum(['active', 'expired', 'terminated']).optional().default('active'),
  notes: z.string().max(500, 'Ghi chú quá dài').nullable().optional(),
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
