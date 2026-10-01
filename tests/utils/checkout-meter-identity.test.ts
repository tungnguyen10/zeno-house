import { describe, expect, it } from 'vitest'
import { meterReadingCreateSchema } from '../../app/utils/validators/meter-readings'
import { mapMeterReading } from '../../app/utils/mappers/meter-readings'

const input = { room_id: '00000000-0000-4000-8000-000000000001', contract_id: '00000000-0000-4000-8000-000000000002', meter_type: 'electricity', reading_type: 'handover_in', period_year: 2026, period_month: 5, reading_date: '2026-05-16', reading_value: 120 }
describe('handover contract identity', () => {
  it('preserves the contract identity through validation and mapping', () => {
    expect(meterReadingCreateSchema.parse(input)).toMatchObject({ contract_id: input.contract_id })
    expect(mapMeterReading({ ...input, id: 'reading-1', building_id: 'building-1' } as never)).toMatchObject({ contractId: input.contract_id })
  })
})
