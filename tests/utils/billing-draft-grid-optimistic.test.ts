import { describe, expect, it } from 'vitest'
import type { BillingDraftGridRow } from '../../app/types/billing'
import {
  formatOptimisticUsage,
  optimisticRowDisplay,
} from '../../app/utils/billing/draft-grid-optimistic'

function row(overrides: Partial<BillingDraftGridRow> = {}): BillingDraftGridRow {
  const base: BillingDraftGridRow = {
    key: 'room-1',
    rowType: 'billable_contract',
    roomId: 'room-1',
    roomNumber: 'A101',
    floor: 1,
    contractId: 'contract-1',
    tenantId: 'tenant-1',
    tenantName: null,
    contractCode: null,
    invoiceId: null,
    invoiceStatus: null,
    editable: true,
    status: 'missing_reading',
    electricity: {
      meterType: 'electricity',
      required: true,
      editable: true,
      previousReadingId: 'prev-e',
      previousValue: 100,
      currentReadingId: null,
      currentValue: null,
      readingDate: null,
      usage: null,
      rate: 4000,
      amount: null,
      pricingType: 'per_kwh',
      overrideId: null,
      source: 'monthly',
      blockerCode: null,
    },
    water: {
      meterType: 'water',
      required: true,
      editable: true,
      previousReadingId: 'prev-w',
      previousValue: 10,
      currentReadingId: null,
      currentValue: null,
      readingDate: null,
      usage: null,
      rate: 15000,
      amount: null,
      pricingType: 'per_m3',
      overrideId: null,
      source: 'monthly',
      blockerCode: null,
    },
    rentAndServiceTotal: 3000000,
    draftTotal: null,
    blockers: [],
    warnings: [],
    lines: [],
  }
  return { ...base, ...overrides }
}

describe('draft grid optimistic display', () => {
  it('calculates electricity, metered water, and row total from local readings', () => {
    const display = optimisticRowDisplay(row(), {
      'room-1::electricity': '125',
      'room-1::water': '14',
    })

    expect(display.electricity.usage).toBe(25)
    expect(display.electricity.amount).toBe(100000)
    expect(display.water.usage).toBe(4)
    expect(display.water.amount).toBe(60000)
    expect(display.draftTotal).toBe(3160000)
  })

  it('does not calculate misleading totals for invalid or empty values', () => {
    const invalid = optimisticRowDisplay(row(), { 'room-1::electricity': 'abc' })
    const empty = optimisticRowDisplay(row(), { 'room-1::electricity': '' })

    expect(invalid.electricity.status).toBe('invalid')
    expect(invalid.draftTotal).toBeNull()
    expect(empty.electricity.status).toBe('empty')
    expect(empty.draftTotal).toBeNull()
  })

  it('warns when a local value is lower than previous', () => {
    const display = optimisticRowDisplay(row(), { 'room-1::electricity': '90' })

    expect(display.electricity.status).toBe('warning')
    expect(formatOptimisticUsage(display.electricity)).toBe('Nhỏ hơn chỉ số cũ')
    expect(display.draftTotal).toBeNull()
  })

  it('leaves non-meter water behavior unchanged', () => {
    const water = row().water!
    const display = optimisticRowDisplay(row({
      water: {
        ...water,
        required: false,
        editable: false,
        source: 'per_person',
        usage: 2,
        amount: 60000,
        pricingType: 'per_person',
      },
      draftTotal: 3060000,
    }), { 'room-1::electricity': '125', 'room-1::water': '14' })

    expect(display.water.status).toBe('not_applicable')
    expect(display.water.amount).toBe(60000)
    expect(display.draftTotal).toBe(3160000)
  })
})
