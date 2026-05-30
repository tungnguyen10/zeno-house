import { z } from 'zod'

export const contractServiceUpdateSchema = z.object({
  amount: z.number().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  is_enabled: z.boolean().optional(),
  notes: z.string().max(200).nullable().optional(),
})

export type ContractServiceUpdateInput = z.infer<typeof contractServiceUpdateSchema>
