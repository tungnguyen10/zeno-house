import { describe, expect, it, vi } from 'vitest'
import {
  BillingAuditRepository,
  decodeBillingAuditCursor,
  encodeBillingAuditCursor,
} from '../../../server/repositories/billing/audit'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn(() => ({ rpc })),
}))

describe('billing audit stable cursor', () => {
  it('round-trips the timestamp and row id tie-breaker', () => {
    const event = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      createdAt: '2026-07-13T04:30:00.000Z',
    }

    const encoded = encodeBillingAuditCursor(event as never)

    expect(encoded).toBe('2026-07-13T04:30:00.000Z|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(decodeBillingAuditCursor(encoded)).toEqual({
      createdAt: '2026-07-13T04:30:00.000Z',
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
  })

  it('accepts legacy timestamp-only cursors', () => {
    expect(decodeBillingAuditCursor('2026-07-13T04:30:00.000Z')).toEqual({
      createdAt: '2026-07-13T04:30:00.000Z',
      id: null,
    })
  })

  it('loads a filtered page in one database round trip', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const event = { method: 'GET', context: {} } as never

    await BillingAuditRepository.listByPeriodFiltered(event, 'period-1', {
      q: 'payment',
      limit: 50,
    })

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('billing_audit_search_page', expect.objectContaining({
      p_period_id: 'period-1',
      p_limit: 50,
      p_query: 'payment',
    }))
    expect(event.context.apiPerformance.dbRoundTrips).toBe(1)
  })
})
