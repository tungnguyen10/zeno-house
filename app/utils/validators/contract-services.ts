import { z } from 'zod'

export const contractServiceUpdateSchema = z.object({
  amount: z.number().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  is_enabled: z.boolean().optional(),
  notes: z.string().max(200).nullable().optional(),
})

export const contractServiceDeleteSchema = z.object({
  reason: z.string().trim().min(1, 'Lý do xoá là bắt buộc').max(500, 'Lý do quá dài'),
})

export type ContractServiceUpdateInput = z.infer<typeof contractServiceUpdateSchema>
export type ContractServiceDeleteInput = z.infer<typeof contractServiceDeleteSchema>
