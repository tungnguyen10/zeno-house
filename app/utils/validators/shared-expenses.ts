import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '~/utils/constants/operations-report'

const periodYear = z.coerce.number().int().min(2000).max(2100)
const periodMonth = z.coerce.number().int().min(1).max(12)

export const sharedExpenseCreateSchema = z.object({
  name: z.string().trim().min(1, 'Tên chi phí là bắt buộc').max(200),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive('Số tiền phải lớn hơn 0'),
  note: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
  building_ids: z.array(z.string().uuid('building_id không hợp lệ')).min(1, 'Chọn ít nhất một tòa nhà'),
})

export type SharedExpenseCreateInput = z.infer<typeof sharedExpenseCreateSchema>

export const sharedExpenseUpdateSchema = sharedExpenseCreateSchema.partial().refine(
  input => Object.keys(input).length > 0,
  'Cần ít nhất một trường để cập nhật',
)

export type SharedExpenseUpdateInput = z.infer<typeof sharedExpenseUpdateSchema>

export const sharedExpenseAllocateSchema = z.object({
  period_year: periodYear,
  period_month: periodMonth,
})

export type SharedExpenseAllocateInput = z.infer<typeof sharedExpenseAllocateSchema>
