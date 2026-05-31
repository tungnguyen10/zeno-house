import type { Tables } from '~/types/database.types'
import type { MeterReading } from '~/types/meter-readings'

export function mapMeterReading(row: Tables<'meter_readings'>): MeterReading {
  return {
    id: row.id,
    roomId: row.room_id,
    buildingId: row.building_id,
    meterType: row.meter_type as 'electricity' | 'water',
    readingType: row.reading_type as 'monthly' | 'handover_in' | 'handover_out',
    periodYear: row.period_year,
    periodMonth: row.period_month,
    readingDate: row.reading_date,
    readingValue: Number(row.reading_value),
    isEstimated: row.is_estimated,
    notes: row.notes,
    recordedBy: row.recorded_by,
    oldReading: row.old_reading != null ? Number(row.old_reading) : null,
    newReading: row.new_reading != null ? Number(row.new_reading) : null,
    consumption: row.consumption != null ? Number(row.consumption) : null,
    isAdjusted: row.is_adjusted ?? false,
    adjustmentReason: row.adjustment_reason ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}
