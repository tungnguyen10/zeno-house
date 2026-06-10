import { z } from 'zod'

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export const contractPaymentCreateSchema = z.object({
  payment_type: z.enum(['deposit', 'prepaid_rent', 'rent', 'other']),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  covered_period_start: z
    .string()
    .regex(PERIOD_REGEX, 'Kỳ bắt đầu phải có định dạng YYYY-MM')
    .nullable()
    .optional(),
  covered_period_end: z
    .string()
    .regex(PERIOD_REGEX, 'Kỳ kết thúc phải có định dạng YYYY-MM')
    .nullable()
    .optional(),
  paid_at: z.string().min(1, 'Ngày thanh toán là bắt buộc'),
  payment_method: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export type ContractPaymentCreateInput = z.infer<typeof contractPaymentCreateSchema>

export const contractPaymentUpdateSchema = contractPaymentCreateSchema.partial()

export type ContractPaymentUpdateInput = z.infer<typeof contractPaymentUpdateSchema>
