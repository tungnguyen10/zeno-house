import { describe, expect, it } from 'vitest'
import type { BillingDraftGridRow } from '../../app/types/billing'
import {
  acceptedBulkReadingUpdates,
  buildBulkReadingPreview,
  parseBulkReadingLines,
} from '../../app/utils/billing/bulk-readings'

function row(overrides: Partial<BillingDraftGridRow> = {}): BillingDraftGridRow {
  const roomId = overrides.roomId ?? 'room-101'
  return {
    key: roomId,
    rowType: 'billable_contract',
    roomId,
    roomNumber: overrides.roomNumber ?? 'A101',
    floor: 1,
    contractId: `contract-${roomId}`,
    tenantId: `tenant-${roomId}`,
    tenantName: null,
    contractCode: null,
    invoiceId: null,
    invoiceStatus: null,
    existingInvoice: null,
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
    rentAndServiceTotal: 0,
    draftTotal: null,
    blockers: [],
    warnings: [],
    lines: [],
    ...overrides,
  }
}

describe('bulk reading parser', () => {
  it('preserves middle blank lines for ordered skips and trims trailing blanks', () => {
    expect(parseBulkReadingLines('123 10\n\n456 12\n\n')).toMatchObject([
      { lineNumber: 1, tokens: ['123', '10'], blank: false },
      { lineNumber: 2, tokens: [], blank: true },
      { lineNumber: 3, tokens: ['456', '12'], blank: false },
    ])
  })

  it('previews ordered rows and skips blank rooms', () => {
    const preview = buildBulkReadingPreview('123 11\n\n150 15', [
      row({ roomNumber: 'A101', roomId: 'r1' }),
      row({ roomNumber: 'A102', roomId: 'r2' }),
      row({ roomNumber: 'A103', roomId: 'r3' }),
    ], { mode: 'ordered' })

    expect(preview.mode).toBe('ordered')
    expect(preview.lines.map(line => [line.roomNumber, line.status])).toEqual([
      ['A101', 'accepted'],
      ['A102', 'skipped'],
      ['A103', 'accepted'],
    ])
    expect(acceptedBulkReadingUpdates(preview)).toHaveLength(4)
  })

  it('previews room-number rows with explicit skip marker', () => {
    const preview = buildBulkReadingPreview('A101 123 12\nA102\nA103 - 15', [
      row({ roomNumber: 'A101', roomId: 'r1' }),
      row({ roomNumber: 'A102', roomId: 'r2' }),
      row({ roomNumber: 'A103', roomId: 'r3' }),
    ])

    expect(preview.mode).toBe('room')
    expect(preview.lines[1]!.status).toBe('skipped')
    expect(preview.lines[2]!.cells.electricity.status).toBe('skipped')
    expect(preview.lines[2]!.cells.water.status).toBe('accepted')
  })

  it('ignores non-applicable water for per-person water rows', () => {
    const water = row().water!
    const preview = buildBulkReadingPreview('A101 123 12', [
      row({
        roomNumber: 'A101',
        water: {
          ...water,
          required: false,
          editable: false,
          pricingType: 'per_person',
          source: 'per_person',
          usage: 2,
          amount: 60000,
        },
      }),
    ])

    expect(preview.lines[0]!.cells.electricity.status).toBe('accepted')
    expect(preview.lines[0]!.cells.water.status).toBe('not_applicable')
    expect(preview.blockingCount).toBe(0)
    expect(acceptedBulkReadingUpdates(preview).map(update => update.type)).toEqual(['electricity'])
  })

  it('reports duplicate, unknown, invalid, and negative values', () => {
    const preview = buildBulkReadingPreview('A101 abc 12\nA404 123 12\nA101 -5 13', [
      row({ roomNumber: 'A101' }),
    ])

    expect(preview.lines[0]!.cells.electricity.status).toBe('invalid')
    expect(preview.lines[1]!.message).toBe('Không tìm thấy phòng')
    expect(preview.lines[2]!.message).toContain('Trùng phòng')
    expect(preview.blockingCount).toBeGreaterThan(0)
  })

  it('marks lower-than-previous values as warnings and accepts them for apply', () => {
    const preview = buildBulkReadingPreview('A101 90 9', [row({ roomNumber: 'A101' })])

    expect(preview.warningCount).toBe(2)
    expect(preview.lines[0]!.cells.electricity.status).toBe('warning')
    expect(acceptedBulkReadingUpdates(preview)).toHaveLength(2)
  })

  it('parses spreadsheet tabs as columns', () => {
    const preview = buildBulkReadingPreview('A101\t123\t12', [row({ roomNumber: 'A101' })])

    expect(preview.lines[0]!.cells.electricity.value).toBe('123')
    expect(preview.lines[0]!.cells.water.value).toBe('12')
  })
})
