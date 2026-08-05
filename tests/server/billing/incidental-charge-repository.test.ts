import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('#supabase/server', () => ({ serverSupabaseServiceRole: vi.fn(() => ({ rpc })) }))

const row = {
  id: '10000000-0000-4000-8000-000000000006',
  billing_period_id: '10000000-0000-4000-8000-000000000002',
  contract_id: '10000000-0000-4000-8000-000000000004',
  room_id: '10000000-0000-4000-8000-000000000005',
  label: 'Làm mất chìa khóa', amount: '150000', note: null,
  operation_id: '10000000-0000-4000-8000-000000000007',
  created_by: '10000000-0000-4000-8000-000000000001',
  created_at: '2026-08-05T10:00:00.000Z', updated_at: '2026-08-05T10:00:00.000Z',
}

describe('BillingIncidentalChargeRepository atomic RPCs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps create input to the idempotent RPC', async () => {
    rpc.mockResolvedValue({ data: [row], error: null })
    const { BillingIncidentalChargeRepository } = await import('../../../server/repositories/billing/incidental-charges')
    const result = await BillingIncidentalChargeRepository.createWithAudit({ context: {} } as never, row.billing_period_id, row.created_by, {
      contract_id: row.contract_id, label: row.label, amount: 150_000, note: null, operation_id: row.operation_id,
    })
    expect(rpc).toHaveBeenCalledWith('create_billing_incidental_charge_with_audit', {
      p_billing_period_id: row.billing_period_id, p_contract_id: row.contract_id,
      p_actor_id: row.created_by, p_label: row.label, p_amount: 150_000,
      p_note: null, p_operation_id: row.operation_id,
    })
    expect(result.amount).toBe(150_000)
  })

  it.each([
    ['INCIDENTAL_CHARGE_VERSION_CONFLICT', 409],
    ['BILLING_PERIOD_LOCKED', 409],
    ['BILLING_INVOICE_LOCKED', 409],
    ['INCIDENTAL_CHARGE_SCOPE_MISMATCH', 422],
    ['INCIDENTAL_CHARGE_NOT_FOUND', 404],
  ])('normalizes %s', async (message, statusCode) => {
    rpc.mockResolvedValue({ data: null, error: { message } })
    const { BillingIncidentalChargeRepository } = await import('../../../server/repositories/billing/incidental-charges')
    await expect(BillingIncidentalChargeRepository.deleteWithAudit(
      { context: {} } as never, row.billing_period_id, row.created_by, row.id, row.updated_at,
    )).rejects.toMatchObject({ statusCode })
  })
})
