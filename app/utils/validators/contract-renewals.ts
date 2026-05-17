import { z } from 'zod'

export const contractRenewSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('extend'),
    new_end_date: z.string().min(1, 'Ngày kết thúc mới là bắt buộc'),
    new_monthly_rent: z.number().min(0).optional(),
    reason: z.string().max(500).nullable().optional(),
  }),
  z.object({
    mode: z.literal('new_contract'),
    new_end_date: z.string().min(1, 'Ngày kết thúc mới là bắt buộc'),
    new_monthly_rent: z.number().min(0, 'Giá thuê không được âm'),
    reason: z.string().max(500).nullable().optional(),
  }),
])

export type ContractRenewInput = z.infer<typeof contractRenewSchema>
