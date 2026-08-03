import { describe, expect, it } from 'vitest'
import {
  aiInvoicePaymentPayloadSchema,
  aiToolPlanRecordInvoicePaymentsSchema,
} from '../../../app/utils/validators/ai'

const uuid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`

describe('AI invoice payment contracts', () => {
  it('accepts one or many rooms and all-unpaid selection', () => {
    expect(aiToolPlanRecordInvoicePaymentsSchema.parse({
      selection: { mode: 'rooms', room_refs: [' 02 ', '02', '03'] },
      period_year: 2026,
      period_month: 7,
    }).selection).toEqual({ mode: 'rooms', room_refs: ['02', '03'] })

    expect(aiToolPlanRecordInvoicePaymentsSchema.parse({
      building_ref: 'zeno',
      selection: { mode: 'all_unpaid' },
    }).selection).toEqual({ mode: 'all_unpaid' })
  })

  it('requires year and month together and bounds room selection', () => {
    expect(aiToolPlanRecordInvoicePaymentsSchema.safeParse({
      selection: { mode: 'rooms', room_refs: ['02'] }, period_year: 2026,
    }).success).toBe(false)
    expect(aiToolPlanRecordInvoicePaymentsSchema.safeParse({
      selection: { mode: 'rooms', room_refs: [] },
    }).success).toBe(false)
    expect(aiToolPlanRecordInvoicePaymentsSchema.safeParse({
      selection: { mode: 'rooms', room_refs: Array.from({ length: 201 }, (_, i) => `${i}`) },
    }).success).toBe(false)
  })

  it('rejects model-supplied amount or payment date', () => {
    expect(aiToolPlanRecordInvoicePaymentsSchema.safeParse({
      selection: { mode: 'rooms', room_refs: ['02'] }, amount: 1000,
    }).success).toBe(false)
    expect(aiToolPlanRecordInvoicePaymentsSchema.safeParse({
      selection: { mode: 'rooms', room_refs: ['02'] }, payment_date: '2026-07-01',
    }).success).toBe(false)
  })

  it('requires a bounded server-owned payment snapshot payload', () => {
    const parsed = aiInvoicePaymentPayloadSchema.parse({
      billing_period_id: uuid('1'),
      payments: [{
        invoice_id: uuid('2'), room_id: uuid('3'),
        expected_updated_at: '2026-07-01T00:00:00.000Z', expected_balance_amount: 1_000_000,
      }],
      payment_date: '2026-07-02', payment_method: 'cash', note: null,
      snapshot_hash: 'a'.repeat(64),
    })
    expect(parsed.payments[0]?.expected_balance_amount).toBe(1_000_000)
  })
})
