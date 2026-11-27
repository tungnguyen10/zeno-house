import { describe, expect, it } from 'vitest'
import { portalInvoiceState, portalToday } from '~/utils/tenant-portal/invoice-state'

describe('tenant invoice obligation display', () => {
  const due = { status: 'issued' as const, balanceAmount: 200_000, dueDate: '2026-11-01', overdueDate: '2026-11-05' }

  it('distinguishes missing due dates from settled balances', () => {
    expect(portalInvoiceState({ ...due, dueDate: null, overdueDate: null })).toMatchObject({ outstanding: true, dueLabel: 'Chưa có hạn thanh toán', inGrace: false })
  })

  it('only explains grace for a positive active obligation', () => {
    expect(portalInvoiceState(due, '2026-11-03')).toMatchObject({ outstanding: true, inGrace: true, overdue: false })
    for (const status of ['paid', 'void', 'draft'] as const) {
      expect(portalInvoiceState({ ...due, status }, '2026-11-03')).toMatchObject({ outstanding: false, inGrace: false, graceLabel: null })
    }
    expect(portalInvoiceState({ ...due, balanceAmount: 0 }, '2026-11-03').inGrace).toBe(false)
  })

  it('treats overdue partial balances as overdue after the grace endpoint', () => {
    expect(portalInvoiceState({ ...due, status: 'partial' }, '2026-11-06')).toMatchObject({ overdue: true, inGrace: false })
    expect(portalInvoiceState(due, '2026-11-05').inGrace).toBe(true)
  })

  it('uses the Vietnamese billing day across the UTC boundary', () => {
    expect(portalToday(new Date('2026-11-27T18:00:00Z'))).toBe('2026-11-28')
  })
})
