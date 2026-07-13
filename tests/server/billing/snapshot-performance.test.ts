import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn(() => ({ rpc })),
}))

describe('BillingSnapshotRepository performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({
      data: {
        building: { id: 'building-1' },
        contracts: [],
        services: [],
        occupants: [],
        readings: [],
        overrides: [],
        invoices: [],
        rooms: [],
        tenants: [],
      },
      error: null,
    })
  })

  it('loads all draft-grid inputs through one snapshot RPC', async () => {
    const { BillingSnapshotRepository } = await import('../../../server/repositories/billing/snapshot')
    const event = { method: 'GET', context: {} } as never

    const snapshot = await BillingSnapshotRepository.load(event, 'period-1')

    expect(snapshot.contracts).toEqual([])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('billing_period_input_snapshot', { p_period_id: 'period-1' })
    expect(event.context.apiPerformance.dbRoundTrips).toBe(1)
  })
})
