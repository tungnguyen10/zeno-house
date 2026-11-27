import { describe, expect, it } from 'vitest'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import { buildPortalFinancialOverview } from '~/utils/tenant-portal/financial-overview'

function invoice(
  month: number,
  totalAmount: number,
  paidAmount: number,
): TenantInvoiceListItem {
  return {
    id: `invoice-${month}`,
    invoiceCode: `HD-${month}`,
    billingPeriodId: `period-${month}`,
    periodYear: 2026,
    periodMonth: month,
    buildingId: 'building-1',
    buildingName: 'Zeno House',
    buildingSlug: 'zeno-house',
    roomId: 'room-1',
    roomNumber: 'A101',
    contractId: 'contract-1',
    contractCode: 'HD-A101',
    totalAmount,
    paidAmount,
    balanceAmount: Math.max(0, totalAmount - paidAmount),
    dueDate: null,
    gracePeriodDays: 0,
    overdueDate: null,
    status: paidAmount >= totalAmount ? 'paid' : 'partial',
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    notes: null,
  }
}

describe('buildPortalFinancialOverview', () => {
  it('selects the newest periods and returns them from left to right chronologically', () => {
    const result = buildPortalFinancialOverview([
      invoice(4, 4_000_000, 4_000_000),
      invoice(6, 6_000_000, 3_000_000),
      invoice(5, 5_000_000, 5_000_000),
    ], 2)

    expect(result.labels).toEqual(['05/26', '06/26'])
    expect(result.totalAmounts).toEqual([5_000_000, 6_000_000])
    expect(result.paidAmounts).toEqual([5_000_000, 3_000_000])
    expect(result.averageMonthlyAmount).toBe(5_500_000)
    expect(result.paidRatio).toBe(73)
  })

  it('returns zero insights for an empty or zero-total series', () => {
    expect(buildPortalFinancialOverview([])).toMatchObject({
      averageMonthlyAmount: 0,
      paidRatio: 0,
    })
    expect(buildPortalFinancialOverview([invoice(6, 0, 0)])).toMatchObject({
      averageMonthlyAmount: 0,
      paidRatio: 0,
    })
  })

  it('clamps the paid ratio to one hundred percent', () => {
    expect(buildPortalFinancialOverview([invoice(6, 1_000_000, 2_000_000)]).paidRatio)
      .toBe(100)
  })

  it('groups valid invoices by month and excludes voided originals from the average', () => {
    const old = { ...invoice(5, 8_000_000, 0), id: 'voided-original', status: 'void' as const }
    const replacement = { ...invoice(5, 4_000_000, 4_000_000), id: 'replacement' }
    const extra = { ...invoice(5, 1_000_000, 0), id: 'supplement' }
    const result = buildPortalFinancialOverview([
      invoice(4, 9_000_000, 0), old, replacement, extra, invoice(6, 6_000_000, 3_000_000),
      { ...invoice(7, 50_000_000, 0), status: 'draft' },
    ], 2)

    expect(result.labels).toEqual(['05/26', '06/26'])
    expect(result.totalAmounts).toEqual([5_000_000, 6_000_000])
    expect(result.paidAmounts).toEqual([4_000_000, 3_000_000])
    expect(result.averageMonthlyAmount).toBe(5_500_000)
    expect(result.paidRatio).toBe(64)
    expect(result.invoices.map(row => row.id)).not.toContain('voided-original')
  })

  it('returns no chart when all invoices are void or the month limit is zero', () => {
    expect(buildPortalFinancialOverview([{ ...invoice(6, 1000, 0), status: 'void' }])).toMatchObject({
      labels: [], totalAmounts: [], paidAmounts: [], averageMonthlyAmount: 0, paidRatio: 0,
    })
    expect(buildPortalFinancialOverview([invoice(6, 1000, 0)], 0).labels).toEqual([])
  })
})
