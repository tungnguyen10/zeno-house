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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
