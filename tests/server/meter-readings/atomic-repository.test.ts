import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn(() => ({ rpc })),
}))

const row = {
  id: '00000000-0000-4000-8000-000000000001',
  room_id: '00000000-0000-4000-8000-000000000002',
  building_id: '00000000-0000-4000-8000-000000000003',
  meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 7,
  reading_date: '2026-07-31', reading_value: 1200, is_estimated: false, notes: null,
  recorded_by: '00000000-0000-4000-8000-000000000004', created_at: '2026-07-14T00:00:00.000Z',
  updated_at: '2026-07-14T00:00:00.000Z', adjustment_reason: null, consumption: null,
  is_adjusted: false, new_reading: null, old_reading: null, updated_by: null,
}

describe('MeterReadingRepository.saveWithAudit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends one normalized batch to the atomic RPC', async () => {
    rpc.mockResolvedValue({ data: [row], error: null })
    const { MeterReadingRepository } = await import('../../../server/repositories/meter-readings')
    const readings = [{
      room_id: row.room_id, meter_type: 'electricity' as const, reading_type: 'monthly' as const,
      period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 1200,
      expected_updated_at: null,
    }]
    const result = await MeterReadingRepository.saveWithAudit({ context: {} } as never, readings, {
      actor_id: row.recorded_by, source: 'ai', action_plan_id: 'plan-1', idempotency_key: 'key-1',
    })

    expect(result).toEqual([expect.objectContaining({ id: row.id, readingValue: 1200 })])
    expect(rpc).toHaveBeenCalledWith('save_meter_readings_with_audit', {
      p_readings: readings,
      p_actor_id: row.recorded_by,
      p_source: 'ai',
      p_action_plan_id: 'plan-1',
      p_idempotency_key: 'key-1',
    })
  })

  it('maps stale versions to a retryable optimistic conflict', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'METER_VERSION_CONFLICT' } })
    const { MeterReadingRepository } = await import('../../../server/repositories/meter-readings')
    await expect(MeterReadingRepository.saveWithAudit({ context: {} } as never, [{
      room_id: row.room_id, meter_type: 'electricity', reading_type: 'monthly',
      period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 1200,
      expected_updated_at: '2026-07-13T00:00:00.000Z',
    }], { actor_id: row.recorded_by, source: 'api' })).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true } } },
    })
  })

  it.each([
    ['BILLING_PERIOD_LOCKED', 'Kỳ đã chốt'],
    ['BILLING_INVOICE_LOCKED', 'hóa đơn'],
  ])('maps %s to a domain conflict', async (message, expected) => {
    rpc.mockResolvedValue({ data: null, error: { message } })
    const { MeterReadingRepository } = await import('../../../server/repositories/meter-readings')
    await expect(MeterReadingRepository.saveWithAudit({ context: {} } as never, [{
      room_id: row.room_id, meter_type: 'electricity', reading_type: 'monthly',
      period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 1200,
      expected_updated_at: null,
    }], { actor_id: row.recorded_by, source: 'api' })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining(expected),
    })
  })
})
