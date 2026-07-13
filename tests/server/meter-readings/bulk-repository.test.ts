import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
const upsert = vi.hoisted(() => vi.fn())
const select = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn(() => ({ from })),
}))

describe('MeterReadingRepository.bulkUpsert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    from.mockReturnValue({ upsert })
    upsert.mockReturnValue({ select })
    select.mockResolvedValue({ data: [], error: null })
  })

  it('persists a multi-room payload with one set-based upsert', async () => {
    const { MeterReadingRepository } = await import('../../../server/repositories/meter-readings')
    const event = { method: 'POST', context: {} } as never

    await MeterReadingRepository.bulkUpsert(event, [
      { room_id: 'room-1', building_id: 'building-1', meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 10 },
      { room_id: 'room-2', building_id: 'building-1', meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 20 },
      { room_id: 'room-3', building_id: 'building-1', meter_type: 'water', reading_type: 'monthly', period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 30 },
    ])

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ room_id: 'room-1' }),
      expect.objectContaining({ room_id: 'room-2' }),
      expect.objectContaining({ room_id: 'room-3' }),
    ]), { onConflict: 'room_id,meter_type,period_year,period_month,reading_type' })
  })
})
