import { z } from 'zod'

export const aiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
}).passthrough()

export const aiChatRequestSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  messages: z.array(aiChatMessageSchema).min(1).max(50),
})

export const aiToolGetMeterStatusSchema = z.object({
  building_id: z.string().min(1),
  period_year: z.number().int().min(2000).max(2100).optional(),
  period_month: z.number().int().min(1).max(12).optional(),
})

export const aiToolGetBillingPeriodOverviewSchema = z.object({
  period_id: z.string().uuid(),
})

export const aiToolOpenBillingPeriodSchema = z.object({
  building_id: z.string().min(1),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
  confirmed: z.boolean().default(false),
  idempotency_key: z.string().min(8).max(120).optional(),
})

export type AiChatRequestInput = z.infer<typeof aiChatRequestSchema>