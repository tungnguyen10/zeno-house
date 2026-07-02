import { z } from 'zod'
import { EXPENSE_CATEGORIES, FIXED_COST_CATEGORIES } from '~/utils/constants/operations-report'

const periodYear = z.coerce.number().int().min(2000).max(2100)
const periodMonth = z.coerce.number().int().min(1).max(12)

// ---------------------------------------------------------------------------
// Operations report query
// ---------------------------------------------------------------------------
export const operationsReportQuerySchema = z.object({
  building_id: z.string().uuid('building_id không hợp lệ'),
  period_year: periodYear,
  period_month: periodMonth,
})

export type OperationsReportQuery = z.infer<typeof operationsReportQuerySchema>

// ---------------------------------------------------------------------------
// Building expenses
// ---------------------------------------------------------------------------
export const buildingExpenseListQuerySchema = z.object({
  building_id: z.string().uuid('building_id không hợp lệ'),
  period_year: periodYear,
  period_month: periodMonth,
  category: z.enum(EXPENSE_CATEGORIES).optional(),
})

export type BuildingExpenseListQuery = z.infer<typeof buildingExpenseListQuerySchema>

export const buildingExpenseCreateSchema = z.object({
  building_id: z.string().uuid('building_id không hợp lệ'),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
  expense_date: z.string().min(1).nullable().optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().nonnegative('Số tiền không được âm'),
  payee: z.string().max(200).nullable().optional(),
  payment_method: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export type BuildingExpenseCreateInput = z.infer<typeof buildingExpenseCreateSchema>

export const buildingExpenseUpdateSchema = buildingExpenseCreateSchema
  .omit({ building_id: true })
  .partial()

export type BuildingExpenseUpdateInput = z.infer<typeof buildingExpenseUpdateSchema>

export const buildingExpenseVoidSchema = z.object({
  void_reason: z.string().min(1, 'Lý do hủy là bắt buộc').max(500),
})

export type BuildingExpenseVoidInput = z.infer<typeof buildingExpenseVoidSchema>

// ---------------------------------------------------------------------------
// Building fixed costs
// ---------------------------------------------------------------------------
export const buildingFixedCostListQuerySchema = z.object({
  building_id: z.string().uuid('building_id không hợp lệ'),
})

export type BuildingFixedCostListQuery = z.infer<typeof buildingFixedCostListQuerySchema>

export const buildingFixedCostCreateSchema = z
  .object({
    building_id: z.string().uuid('building_id không hợp lệ'),
    category: z.enum(FIXED_COST_CATEGORIES).default('rent'),
    amount: z.number().nonnegative('Số tiền không được âm'),
    effective_from_period_year: z.number().int().min(2000).max(2100),
    effective_from_period_month: z.number().int().min(1).max(12),
    effective_to_period_year: z.number().int().min(2000).max(2100).nullable().optional(),
    effective_to_period_month: z.number().int().min(1).max(12).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine(
    d =>
      (d.effective_to_period_year == null && d.effective_to_period_month == null) ||
      (d.effective_to_period_year != null && d.effective_to_period_month != null),
    { message: 'Kỳ kết thúc phải có cả năm và tháng', path: ['effective_to_period_month'] },
  )
  .refine(
    (d) => {
      if (d.effective_to_period_year == null || d.effective_to_period_month == null) return true
      const from = d.effective_from_period_year * 12 + d.effective_from_period_month
      const to = d.effective_to_period_year * 12 + d.effective_to_period_month
      return to >= from
    },
    { message: 'Kỳ kết thúc phải sau hoặc bằng kỳ bắt đầu', path: ['effective_to_period_month'] },
  )

export type BuildingFixedCostCreateInput = z.infer<typeof buildingFixedCostCreateSchema>

export const buildingFixedCostUpdateSchema = z
  .object({
    amount: z.number().nonnegative('Số tiền không được âm').optional(),
    note: z.string().max(500).nullable().optional(),
    effective_to_period_year: z.number().int().min(2000).max(2100).nullable().optional(),
    effective_to_period_month: z.number().int().min(1).max(12).nullable().optional(),
  })
  .refine(
    d =>
      d.effective_to_period_year === undefined ||
      d.effective_to_period_month === undefined ||
      (d.effective_to_period_year == null && d.effective_to_period_month == null) ||
      (d.effective_to_period_year != null && d.effective_to_period_month != null),
    { message: 'Kỳ kết thúc phải có cả năm và tháng', path: ['effective_to_period_month'] },
  )

export type BuildingFixedCostUpdateInput = z.infer<typeof buildingFixedCostUpdateSchema>
