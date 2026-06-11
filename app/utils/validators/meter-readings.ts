import { z } from 'zod'

export const meterReadingCreateSchema = z.object({
  room_id: z.string().uuid(),
  meter_type: z.enum(['electricity', 'water']),
  period_year: z.number().int().min(2000).max(2100),
  period_month: z.number().int().min(1).max(12),
  reading_type: z.enum(['monthly', 'handover_in', 'handover_out']),
  reading_date: z.string(),
  reading_value: z.number().min(0),
  is_estimated: z.boolean().optional(),
  notes: z.string().max(300).nullable().optional(),
})

export const meterReadingBulkSchema = z.object({
  readings: z.array(meterReadingCreateSchema).min(1),
})

export const meterReadingUpdateSchema = meterReadingCreateSchema.partial()

export type MeterReadingCreateInput = z.infer<typeof meterReadingCreateSchema>
export type MeterReadingBulkInput = z.infer<typeof meterReadingBulkSchema>
export type MeterReadingUpdateInput = z.infer<typeof meterReadingUpdateSchema>
