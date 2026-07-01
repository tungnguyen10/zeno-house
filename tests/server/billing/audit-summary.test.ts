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

  it('formats the new simplified-workflow action codes', () => {
    expect(formatAuditSummary('invoice.printed', { format: 'print' })).toBe('In hoá đơn (print)')
    expect(formatAuditSummary('invoice.printed', {})).toBe('In hoá đơn')

    expect(formatAuditSummary('period.reopened', { reason: 'sửa chỉ số điện' }))
      .toBe('Mở lại kỳ vận hành — sửa chỉ số điện')
    expect(formatAuditSummary('period.reopened', {})).toBe('Mở lại kỳ vận hành')

    const undone = formatAuditSummary('payment.undone', { amount: 50_000, reason: 'khách trả nhầm' })
    expect(undone).toContain('Hoàn tác thu tiền')
    expect(undone).toContain('khách trả nhầm')

    const edited = formatAuditSummary('payment.edited', { old_amount: 100_000, new_amount: 120_000 })
    expect(edited).toContain('Sửa khoản thu')
    expect(edited).toContain('→')
  })

  it('renders reading.saved with a before/after diff', () => {
    expect(
      formatAuditSummary('reading.saved', {
        meter_type: 'electricity',
        previous_value: 1500,
        new_value: 1520,
        unit: 'kWh',
      }),
    ).toBe('Lưu chỉ số điện: 1500 → 1520 kWh (+20)')

    expect(
      formatAuditSummary('reading.saved', { meter_type: 'water', new_value: 50, unit: 'm³' }),
    ).toBe('Lưu chỉ số nước: 50 m³')

    expect(
      formatAuditSummary('reading.saved', { count: 2, meter_type: 'electricity' }),
    ).toBe('Lưu 2 chỉ số điện')
  })
})
