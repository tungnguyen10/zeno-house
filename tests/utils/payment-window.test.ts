import { describe, expect, it } from 'vitest'
import { formatPaymentWindow } from '~/utils/format/payment-window'

describe('formatPaymentWindow', () => {
  it('builds the exact contract sentence', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 })).toEqual({
      startDay: 1, endDay: 5, graceDays: 5, overdueDay: 10,
      sentence: 'Thanh toán từ ngày 1 đến ngày 5 hằng tháng; sau ngày 10 không thanh toán, Bên A có quyền chấm dứt hợp đồng.',
    })
  })

  it('preserves a zero grace period', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 0 })).toEqual({
      startDay: 1, endDay: 5, graceDays: 0, overdueDay: 5,
      sentence: 'Thanh toán từ ngày 1 đến ngày 5 hằng tháng; sau ngày 5 không thanh toán, Bên A có quyền chấm dứt hợp đồng.',
    })
  })

  it('keeps day 31 as an explicit overdue day', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 25, paymentDueDay: 28, gracePeriodDays: 3 })).toMatchObject({
      overdueDay: 31,
      sentence: 'Thanh toán từ ngày 25 đến ngày 28 hằng tháng; sau ngày 31 không thanh toán, Bên A có quyền chấm dứt hợp đồng.',
    })
  })

  it('uses a grace duration when the candidate day exceeds 31', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 25, paymentDueDay: 28, gracePeriodDays: 5 })).toEqual({
      startDay: 25, endDay: 28, graceDays: 5, overdueDay: null,
      sentence: 'Thanh toán từ ngày 25 đến ngày 28 hằng tháng; quá 5 ngày sau hạn thanh toán, Bên A có quyền chấm dứt hợp đồng.',
    })
  })

  it.each([
    { billingGenerationDay: null, paymentDueDay: 5, gracePeriodDays: 0 },
    { billingGenerationDay: 1, paymentDueDay: null, gracePeriodDays: 0 },
    { billingGenerationDay: null, paymentDueDay: null, gracePeriodDays: 0 },
  ])('returns null for an incomplete schedule %#', (building) => {
    expect(formatPaymentWindow(building)).toBeNull()
  })
})
