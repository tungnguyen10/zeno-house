import { formatAuditSummary } from '../../../server/services/billing/audit-summary'

describe('billing audit summary formatter', () => {
  it('formats documented actions', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['period.opened', {}],
      ['period.status_changed', { from: 'draft', to: 'issued' }],
      ['period.closed', {}],
      ['period.unissued', {}],
      ['reading.saved', { count: 2 }],
      ['utility.override_saved', { meter_type: 'electricity', reason: 'replacement' }],
      ['invoices.issued', { issued_count: 3, due_date: '2026-06-05' }],
      ['invoice.voided', { reason: 'wrong amount', total_amount: 100_000 }],
      ['invoice.reissued', { old_total_amount: 100_000, new_total_amount: 120_000 }],
      ['invoice.adjustment_created', { label: 'credit', amount: -50_000 }],
      ['payment.recorded', { amount: 50_000, payment_method: 'cash' }],
      ['payments.bulk_recorded', { count: 3 }],
      ['invoice.issue_attempted', { blocked_count: 1 }],
    ]

    expect(cases.map(([action, meta]) => formatAuditSummary(action, meta))).toMatchSnapshot()
  })

  it('handles missing optional metadata', () => {
    expect(formatAuditSummary('payment.recorded', { amount: 50_000 })).toContain('50')
  })

  it('falls back for unknown action', () => {
    expect(formatAuditSummary('custom.action', {})).toBe('Hành động: custom.action')
  })
})
