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
  // billing fields (v0.3)
  old_reading: z.number().min(0).nullable().optional(),
  new_reading: z.number().min(0).nullable().optional(),
  consumption: z.number().nullable().optional(),
  is_adjusted: z.boolean().optional(),
  adjustment_reason: z.string().max(500).nullable().optional(),
}).refine(
  (data) => {
    if (data.is_adjusted === true) {
      return data.adjustment_reason != null && data.adjustment_reason.trim().length > 0
    }
    return true
  },
  { message: 'adjustment_reason is required when is_adjusted is true', path: ['adjustment_reason'] },
)

export const meterReadingBulkSchema = z.object({
  readings: z.array(meterReadingCreateSchema).min(1),
})

export const meterReadingUpdateSchema = z.object({
  room_id: z.string().uuid().optional(),
  meter_type: z.enum(['electricity', 'water']).optional(),
  period_year: z.number().int().min(2000).max(2100).optional(),
  period_month: z.number().int().min(1).max(12).optional(),
  reading_type: z.enum(['monthly', 'handover_in', 'handover_out']).optional(),
  reading_date: z.string().optional(),
  reading_value: z.number().min(0).optional(),
  is_estimated: z.boolean().optional(),
  notes: z.string().max(300).nullable().optional(),
  old_reading: z.number().min(0).nullable().optional(),
  new_reading: z.number().min(0).nullable().optional(),
  consumption: z.number().nullable().optional(),
  is_adjusted: z.boolean().optional(),
  adjustment_reason: z.string().max(500).nullable().optional(),
}).refine(
  (data) => {
    if (data.is_adjusted === true) {
      return data.adjustment_reason != null && data.adjustment_reason.trim().length > 0
    }
    return true
  },
  { message: 'adjustment_reason is required when is_adjusted is true', path: ['adjustment_reason'] },
)

export type MeterReadingCreateInput = z.infer<typeof meterReadingCreateSchema>
export type MeterReadingBulkInput = z.infer<typeof meterReadingBulkSchema>
export type MeterReadingUpdateInput = z.infer<typeof meterReadingUpdateSchema>
