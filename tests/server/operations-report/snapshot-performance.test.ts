import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn(() => ({ rpc })),
}))

describe('OperationsReportRepository snapshot performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({
      data: {
        billing_period: null,
        invoices: [],
        fixed_costs: [],
        expenses: [],
        prepaid_items: [],
        closure: null,
        reserve_transactions: [],
        reserve_rate: null,
      },
      error: null,
    })
  })

  it('loads report inputs through one aggregate RPC', async () => {
    const { OperationsReportRepository } = await import('../../../server/repositories/operations-report/report')
    const event = { method: 'GET', context: {} } as never

    const snapshot = await OperationsReportRepository.fetchSnapshot(event, 'building-1', 2026, 7)

    expect(snapshot.billing.invoices).toEqual([])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('operations_report_snapshot', {
      p_building_id: 'building-1',
      p_period_year: 2026,
      p_period_month: 7,
    })
    expect(event.context.apiPerformance.dbRoundTrips).toBe(1)
  })
})
