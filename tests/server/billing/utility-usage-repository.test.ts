import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('#supabase/server', () => ({ serverSupabaseServiceRole: vi.fn(() => ({ rpc })) }))

const row = {
  id: '00000000-0000-4000-8000-000000000001', billing_period_id: '00000000-0000-4000-8000-000000000002',
  room_id: '00000000-0000-4000-8000-000000000003', meter_type: 'electricity',
  previous_reading_id: null, previous_reading_value: 100, current_reading_id: null, current_reading_value: 90,
  old_meter_final_value: null, new_meter_start_value: null, billable_usage: 10, reason: 'correction',
  note: 'Đính chính chỉ số điện', created_by: '00000000-0000-4000-8000-000000000004',
  created_at: '2026-07-14T00:00:00.000Z', updated_at: '2026-07-14T00:00:00.000Z',
  approved_by: null, approved_at: null,
}

describe('BillingUtilityUsageRepository.saveWithAudit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the atomic override RPC without leaking the version into override data', async () => {
    rpc.mockResolvedValue({ data: [row], error: null })
    const { BillingUtilityUsageRepository } = await import('../../../server/repositories/billing/utility-usages')
    const input = {
      room_id: row.room_id, meter_type: 'electricity' as const,
      previous_reading_value: 100, current_reading_value: 90, billable_usage: 10,
      reason: 'correction' as const, note: row.note,
      expected_updated_at: row.updated_at,
    }
    await BillingUtilityUsageRepository.saveWithAudit({ context: {} } as never, row.billing_period_id, row.created_by, input, {
      source: 'ai', action_plan_id: 'plan-1', idempotency_key: 'key-1',
    })
    expect(rpc).toHaveBeenCalledWith('save_utility_usage_override_with_audit', expect.objectContaining({
      p_override: expect.not.objectContaining({ expected_updated_at: expect.anything() }),
      p_expected_updated_at: row.updated_at,
      p_source: 'ai', p_action_plan_id: 'plan-1', p_idempotency_key: 'key-1',
    }))
  })

  it('maps stale override state to an optimistic conflict', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'UTILITY_OVERRIDE_VERSION_CONFLICT' } })
    const { BillingUtilityUsageRepository } = await import('../../../server/repositories/billing/utility-usages')
    await expect(BillingUtilityUsageRepository.saveWithAudit({ context: {} } as never, row.billing_period_id, row.created_by, {
      room_id: row.room_id, meter_type: 'electricity', previous_reading_value: 100,
      current_reading_value: 90, billable_usage: 10, reason: 'correction', note: row.note,
      expected_updated_at: row.updated_at,
    }, { source: 'api' })).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'OPTIMISTIC_LOCK_CONFLICT' } } },
    })
  })
})
