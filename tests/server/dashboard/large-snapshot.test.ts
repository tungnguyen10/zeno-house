import { vi } from 'vitest'
import type { H3Event } from 'h3'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn(() => ({ rpc })),
}))

describe('DashboardRepository snapshot performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({
      data: {
        buildings: [{ id: 'building-1', slug: 'one', name: 'One' }],
        rooms: Array.from({ length: 2501 }, (_, index) => ({
          id: `room-${index}`,
          building_id: 'building-1',
          status: index % 2 === 0 ? 'occupied' : 'available',
        })),
        tenant_count: 2501,
        active_contract_count: 2501,
        expiring_contract_count: 0,
        urgent_contract_count: 0,
        periods: [],
        invoices: [],
      },
      error: null,
    })
  })

  it('keeps results complete beyond the former 2000-row limit with one RPC', async () => {
    const { DashboardRepository } = await import('../../../server/repositories/dashboard')
    const event = { method: 'GET', context: {} } as unknown as H3Event
    const result = await DashboardRepository.getSummary(event, ['building-1'])

    expect(result.summary.rooms.total).toBe(2501)
    expect(result.summary.tenants.total).toBe(2501)
    expect(result.summary.contracts.active).toBe(2501)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('dashboard_source_snapshot', expect.objectContaining({
      p_building_ids: ['building-1'],
    }))
    expect(event.context.apiPerformance.dbRoundTrips).toBe(1)
  })
})
