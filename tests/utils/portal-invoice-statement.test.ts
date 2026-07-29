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
  it('sorts billing periods latest-first without mutating the input', () => {
    const invoices = [
      invoice('feb-2025', 2025, 2),
      invoice('jan-2026', 2026, 1),
      invoice('dec-2025', 2025, 12),
      invoice('jul-2026', 2026, 7),
    ]
    const originalOrder = [...invoices]

    expect(groupTenantInvoicesByYear(invoices)).toEqual([
      { year: 2026, invoices: [invoices[3], invoices[1]] },
      { year: 2025, invoices: [invoices[2], invoices[0]] },
    ])
    expect(invoices).toEqual(originalOrder)
  })

  it('preserves the original relative order for invoices in the same period', () => {
    const invoices = [
      invoice('jan-2026-a', 2026, 1),
      invoice('feb-2026', 2026, 2),
      invoice('jan-2026-b', 2026, 1),
    ]

    expect(groupTenantInvoicesByYear(invoices)).toEqual([
      { year: 2026, invoices: [invoices[1], invoices[0], invoices[2]] },
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
