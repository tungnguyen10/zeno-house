import { z } from 'zod'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có định dạng YYYY-MM-DD').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Ngày không hợp lệ')
const money = z.number().int().min(0).max(999_999_999_999)
const operationId = z.string().uuid('Mã thao tác không hợp lệ')
const expectedVersion = z.string().datetime({ offset: true })

export const checkoutMeterSchema = z.object({
  reading: z.number().finite().min(0).max(999_999_999),
  usageOverride: z.number().finite().min(0).max(999_999_999).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
}).strict().refine(value => value.usageOverride == null || Boolean(value.reason?.trim()), {
  message: 'Cần ghi lý do điều chỉnh sản lượng', path: ['reason'],
})

export const checkoutDraftSchema = z.object({
  actual_return_date: dateSchema,
  reason: z.string().trim().min(1, 'Nhập lý do trả phòng').max(500),
  electricity: checkoutMeterSchema.nullable().optional(),
  water: checkoutMeterSchema.nullable().optional(),
  expected_updated_at: expectedVersion.nullable().optional(),
}).strict()
export const checkoutReturnSchema = z.object({
  operation_id: operationId,
  expected_updated_at: expectedVersion,
}).strict()
export const checkoutConfirmSchema = z.object({
  operation_id: operationId,
  snapshot_hash: z.string().min(16).max(128),
}).strict()
export const checkoutChargeModeSchema = z.object({
  mode: z.enum(['prorated', 'full_month', 'waived']),
  reason: z.string().trim().max(500).nullable().optional(),
}).strict().refine(value => value.mode !== 'waived' || Boolean(value.reason?.trim()), { path: ['reason'], message: 'Cần ghi lý do miễn thu' })
export const checkoutChargeModesSchema = z.object({
  expected_updated_at: expectedVersion,
  modes: z.record(z.string(), checkoutChargeModeSchema),
}).strict()
export const checkoutRefundSchema = z.object({
  operation_id: operationId,
  amount: money.positive('Số tiền phải lớn hơn 0'),
  paid_at: dateSchema,
  payment_method: z.string().trim().min(1, 'Chọn phương thức hoàn tiền').max(100),
  note: z.string().trim().max(500).nullable().optional(),
}).strict()
export const checkoutCreditSchema = z.object({
  operation_id: operationId,
  payment_id: z.string().uuid(),
  amount: money.positive(),
  reason: z.string().trim().min(1, 'Nhập lý do xác nhận khoản dư').max(500),
}).strict()
export const checkoutChargeSchema = z.object({
  operation_id: operationId,
  label: z.string().trim().min(1, 'Nhập tên khoản phát sinh').max(200),
  amount: money.positive(),
  note: z.string().trim().max(500).nullable().optional(),
}).strict()
export const checkoutCorrectionSchema = z.object({
  operation_id: operationId,
  invoice_id: z.string().uuid(),
  amount: z.number().int().min(-999_999_999_999).max(999_999_999_999).refine(value => value !== 0, 'Số tiền điều chỉnh phải khác 0'),
  label: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1, 'Nhập lý do điều chỉnh').max(500),
  expected_updated_at: expectedVersion,
}).strict()

export type CheckoutReturnInput = z.infer<typeof checkoutReturnSchema>
export type CheckoutConfirmInput = z.infer<typeof checkoutConfirmSchema>
export type CheckoutChargeModesInput = z.infer<typeof checkoutChargeModesSchema>
export type CheckoutRefundInput = z.infer<typeof checkoutRefundSchema>
export type CheckoutCreditInput = z.infer<typeof checkoutCreditSchema>
export type CheckoutChargeInput = z.infer<typeof checkoutChargeSchema>
export type CheckoutCorrectionInput = z.infer<typeof checkoutCorrectionSchema>
