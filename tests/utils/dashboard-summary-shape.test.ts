import { describe, expect, it } from 'vitest'
import type { DashboardSummary } from '../../app/types/dashboard'

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
})
