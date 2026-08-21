import type { ContractAmendmentChangeSet } from '~/types/contract-amendments'
import { z } from 'zod'

const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hiệu lực không hợp lệ')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return false
    const date = new Date(Date.UTC(year, month - 1, day))
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Ngày hiệu lực không hợp lệ')
const optimisticTimestampSchema = z.string().datetime({ offset: true })
const maxVndAmount = 999_999_999_999
const vndAmountSchema = z.number()
  .int('Số tiền phải là số nguyên VND')
  .min(0, 'Số tiền không được âm')
  .max(maxVndAmount, 'Số tiền vượt quá giới hạn lưu trữ')

export const contractAmendmentIdSchema = z.string().uuid('Mã phụ lục hợp đồng không hợp lệ')

export const contractAmendmentChangesSchema = z.strictObject({
  monthly_rent: vndAmountSchema.optional(),
  deposit: vndAmountSchema.optional(),
  payment_due_day: z.number().int().min(1).max(31).nullable().optional(),
  occupant_count: z.number().int().min(1, 'Số người ở ít nhất là 1').optional(),
  discount_amount: vndAmountSchema.optional(),
  surcharge_amount: vndAmountSchema.optional(),
}).refine(changes => Object.keys(changes).length > 0, {
  message: 'Phụ lục phải thay đổi ít nhất một điều khoản',
})

const draftFields = {
  title: z.string().trim().min(1, 'Tiêu đề phụ lục là bắt buộc').max(120, 'Tiêu đề phụ lục quá dài'),
  public_content: z.string().trim().min(1, 'Nội dung công khai là bắt buộc').max(5000, 'Nội dung công khai quá dài'),
  effective_date: isoDateSchema,
  changes: contractAmendmentChangesSchema,
}

export const contractAmendmentCreateSchema = z.strictObject(draftFields)

export const contractAmendmentUpdateSchema = z.strictObject({
  ...draftFields,
  expected_updated_at: optimisticTimestampSchema,
})

export const contractAmendmentPublishSchema = z.strictObject({
  expected_updated_at: optimisticTimestampSchema,
})

export const contractAmendmentCancelSchema = z.strictObject({
  expected_updated_at: optimisticTimestampSchema,
  reason: z.string().trim().min(1, 'Lý do hủy là bắt buộc').max(500, 'Lý do hủy quá dài'),
})

export const contractAmendmentDeleteSchema = z.strictObject({
  expected_updated_at: optimisticTimestampSchema,
})

export type ContractAmendmentCreateInput = z.infer<typeof contractAmendmentCreateSchema>
export type ContractAmendmentUpdateInput = z.infer<typeof contractAmendmentUpdateSchema>
export type ContractAmendmentPublishInput = z.infer<typeof contractAmendmentPublishSchema>
export type ContractAmendmentCancelInput = z.infer<typeof contractAmendmentCancelSchema>
export type ContractAmendmentDeleteInput = z.infer<typeof contractAmendmentDeleteSchema>
export type ContractAmendmentChangesInput = z.infer<typeof contractAmendmentChangesSchema>

const recurringKeys = new Set<keyof ContractAmendmentChangesInput>([
  'monthly_rent',
  'payment_due_day',
  'occupant_count',
  'discount_amount',
  'surcharge_amount',
])

export function recurringAmendmentRequiresMonthBoundary(
  changes: ContractAmendmentChangesInput | ContractAmendmentChangeSet,
): boolean {
  return Object.keys(changes).some(key => recurringKeys.has(key as keyof ContractAmendmentChangesInput)
    || ['monthlyRent', 'paymentDueDay', 'occupantCount', 'discountAmount', 'surchargeAmount'].includes(key))
}
