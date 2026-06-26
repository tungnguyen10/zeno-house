import { describe, expect, it } from 'vitest'
import type {
  DashboardSummary,
  DashboardSummaryMeta,
  DashboardSummaryResponse,
  PendingOperation,
} from '../../app/types/dashboard'

describe('dashboard summary shape', () => {
  it('supports the expanded operational summary contract', () => {
    const summary: DashboardSummary = {
      buildings: { total: 0 },
      rooms: { total: 0, available: 0, occupied: 0, maintenance: 0 },
      tenants: { total: 0 },
      contracts: { active: 0, expiringSoon: 0 },
      billing: {
        currentMonth: {
          period: '2026-06',
          invoiceTotal: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          overdueAmount: 0,
        },
      },
      buildingBreakdown: [],
      billingTrend: [],
      pendingOperations: [],
    }

    expect(summary.contracts.expiringSoon).toBe(0)
    expect(summary.billing.currentMonth.outstandingAmount).toBe(0)
    expect(summary.pendingOperations).toEqual([])
  })

  it('PendingOperation uses a nested building object instead of href', () => {
    const item: PendingOperation = {
      type: 'unissued_invoices',
      building: { id: 'b1', slug: 'toa-a', name: 'Toa A' },
      period: '2026-06',
      count: 1,
      severity: 'info',
    }
    expect(item.building.slug).toBe('toa-a')
    expect((item as Record<string, unknown>).href).toBeUndefined()
    expect((item as Record<string, unknown>).buildingId).toBeUndefined()
    expect((item as Record<string, unknown>).buildingSlug).toBeUndefined()
    expect((item as Record<string, unknown>).buildingName).toBeUndefined()
  })

  it('DashboardSummaryResponse carries meta.generatedAt', () => {
    const meta: DashboardSummaryMeta = { generatedAt: '2026-06-25T10:00:00.000Z' }
    const response: DashboardSummaryResponse = {
      data: {
        buildings: { total: 0 },
        rooms: { total: 0, available: 0, occupied: 0, maintenance: 0 },
        tenants: { total: 0 },
        contracts: { active: 0, expiringSoon: 0 },
        billing: {
          currentMonth: {
            period: '2026-06',
            invoiceTotal: 0,
            paidAmount: 0,
            outstandingAmount: 0,
            overdueAmount: 0,
          },
        },
        buildingBreakdown: [],
        billingTrend: [],
        pendingOperations: [],
      },
      meta,
    }
    expect(response.meta?.generatedAt).toBe('2026-06-25T10:00:00.000Z')
  })
})
