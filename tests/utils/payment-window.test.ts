import { describe, expect, it } from 'vitest'
import { formatPaymentWindow } from '~/utils/format/payment-window'

describe('formatPaymentWindow', () => {
  it('builds the contract sentence', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 })).toEqual({
      startDay: 1, endDay: 5, graceDays: 5, overdueDay: 10,
      sentence: 'Thanh toán từ ngày 1 đến ngày 5 hằng tháng; sau ngày 10 không thanh toán, Bên A có quyền chấm dứt hợp đồng.',
    })
  })

  it('uses the due day when there is no grace period', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 0 })!.overdueDay).toBe(5)
  })

  it('does not print an impossible day past 31', () => {
    const w = formatPaymentWindow({ billingGenerationDay: 25, paymentDueDay: 28, gracePeriodDays: 5 })!
    expect(w.overdueDay).toBeNull()
    expect(w.sentence).toBe('Thanh toán từ ngày 25 đến ngày 28 hằng tháng; quá 5 ngày sau hạn thanh toán, Bên A có quyền chấm dứt hợp đồng.')
  })

  it('returns null when schedule is incomplete', () => {
    expect(formatPaymentWindow({ billingGenerationDay: null, paymentDueDay: 5, gracePeriodDays: 0 })).toBeNull()
  })
})
