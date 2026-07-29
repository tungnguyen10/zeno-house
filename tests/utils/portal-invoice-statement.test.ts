import { describe, expect, it } from 'vitest'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import {
  groupTenantInvoicesByYear,
  tenantInvoicePaymentProgress,
} from '~/utils/tenant-portal/invoice-statement'

function invoice(
  id: string,
  periodYear: number,
  periodMonth: number,
): TenantInvoiceListItem {
  return {
    id,
    invoiceCode: `HD-${id}`,
    billingPeriodId: `period-${id}`,
    periodYear,
    periodMonth,
    buildingId: 'building-1',
    buildingName: 'Toà A',
    buildingSlug: 'toa-a',
    roomId: 'room-1',
    roomNumber: '101',
    contractId: 'contract-1',
    contractCode: 'HĐ-1',
    totalAmount: 1_000_000,
    paidAmount: 0,
    balanceAmount: 1_000_000,
    dueDate: '2026-07-15',
    status: 'issued',
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    notes: null,
  }
}

describe('groupTenantInvoicesByYear', () => {
  it('groups invoices by year while preserving backend order', () => {
    const invoices = [
      invoice('jul-2026', 2026, 7),
      invoice('jan-2026', 2026, 1),
      invoice('dec-2025', 2025, 12),
      invoice('nov-2025', 2025, 11),
    ]

    expect(groupTenantInvoicesByYear(invoices)).toEqual([
      { year: 2026, invoices: [invoices[0], invoices[1]] },
      { year: 2025, invoices: [invoices[2], invoices[3]] },
    ])
  })

  it('does not sort non-contiguous years or their invoices', () => {
    const invoices = [
      invoice('first-2025', 2025, 8),
      invoice('only-2026', 2026, 1),
      invoice('second-2025', 2025, 2),
    ]

    expect(groupTenantInvoicesByYear(invoices)).toEqual([
      { year: 2025, invoices: [invoices[0], invoices[2]] },
      { year: 2026, invoices: [invoices[1]] },
    ])
  })
})

describe('tenantInvoicePaymentProgress', () => {
  it.each([
    [1_000_000, 0, 0],
    [1_000_000, 250_000, 25],
    [1_000_000, 1_000_000, 100],
    [1_000_000, 1_500_000, 100],
    [0, 0, 0],
    [-1, 500_000, 0],
  ])('returns a clamped percentage for total %s and paid %s', (total, paid, expected) => {
    expect(tenantInvoicePaymentProgress(total, paid)).toBe(expected)
  })
})
