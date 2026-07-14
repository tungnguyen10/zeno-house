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
  readings: z.array(meterReadingCreateSchema).min(1).max(500, 'Tối đa 500 chỉ số trong một lần lưu'),
})

export const meterReadingUpdateSchema = meterReadingCreateSchema.pick({
  reading_date: true,
  reading_value: true,
  is_estimated: true,
  notes: true,
}).partial().extend({
  expected_updated_at: z.string().datetime({ offset: true }),
})

export type MeterReadingCreateInput = z.infer<typeof meterReadingCreateSchema>
export type MeterReadingBulkInput = z.infer<typeof meterReadingBulkSchema>
export type MeterReadingUpdateInput = z.infer<typeof meterReadingUpdateSchema>

export type MeterReadingAtomicInput = MeterReadingCreateInput & {
  expected_updated_at: string | null
}
