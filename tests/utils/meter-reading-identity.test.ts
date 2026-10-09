import { describe, expect, it } from 'vitest'
import { meterReadingIdentity } from '../../app/utils/meter-reading-identity'

describe('meter reading identity', () => {
  it('keeps monthly room periods and contract handovers independent of handover dates', () => {
    const row = { room_id: 'room-1', contract_id: 'contract-1', meter_type: 'electricity', reading_type: 'handover_in', period_year: 2026, period_month: 5 }
    expect(meterReadingIdentity(row)).toBe(meterReadingIdentity({ ...row, period_month: 6 }))
    expect(meterReadingIdentity(row)).not.toBe(meterReadingIdentity({ ...row, contract_id: 'contract-2' }))
    expect(meterReadingIdentity({ ...row, contract_id: null, reading_type: 'monthly' })).toBe('room-1:electricity:2026:5:monthly')
  })
})
