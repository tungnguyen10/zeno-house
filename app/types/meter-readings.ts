export interface MeterReading {
  id: string
  roomId: string
  buildingId: string
  meterType: 'electricity' | 'water'
  readingType: 'monthly' | 'handover_in' | 'handover_out'
  periodYear: number
  periodMonth: number
  readingDate: string
  readingValue: number
  isEstimated: boolean
  notes: string | null
  recordedBy: string | null
  createdAt: string
  updatedAt: string
}

// Alias matching spec task 2.2 — structurally equivalent to MeterReadingCreateInput
export interface BulkReadingInput {
  room_id: string
  meter_type: 'electricity' | 'water'
  period_year: number
  period_month: number
  reading_type: 'monthly' | 'handover_in' | 'handover_out'
  reading_date: string
  reading_value: number
  is_estimated?: boolean
  notes?: string | null
}

export interface RoomMeterStatus {
  roomId: string
  roomNumber: string
  floor: number
  devices: {
    meterType: 'electricity' | 'water'
    existingReading: MeterReading | null
    previousReading: MeterReading | null
  }[]
}
