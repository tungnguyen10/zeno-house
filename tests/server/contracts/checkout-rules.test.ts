import { describe, expect, it } from 'vitest'
import { calculateCheckoutTotals } from '../../../app/utils/checkout'
import { checkoutDraftSchema, checkoutRefundSchema, checkoutConfirmSchema, checkoutChargeModesSchema } from '../../../app/utils/validators/checkout'

describe('checkout money conservation', () => {
  it('includes prorated rent and final charges before calculating held deposit', () => {
    expect(calculateCheckoutTotals({ depositHeld: 5_000_000, creditHeld: 0, existingDebt: 200_000, finalChargesTotal: 1_096_000 }))
      .toEqual({ totalDue: 1_296_000, refundDue: 3_704_000, additionalDue: 0, creditApplied: 0, depositApplied: 1_296_000 })
  })
  it('uses approved credit before deposits and preserves exact balances', () => {
    expect(calculateCheckoutTotals({ depositHeld: 100_001, creditHeld: 30_001, existingDebt: 50_003, finalChargesTotal: 0 }))
      .toEqual({ totalDue: 50_003, refundDue: 79_999, additionalDue: 0, creditApplied: 30_001, depositApplied: 20_002 })
  })
  it('leaves debt when held funds are insufficient', () => {
    expect(calculateCheckoutTotals({ depositHeld: 100, creditHeld: 20, existingDebt: 250, finalChargesTotal: 50 }).additionalDue).toBe(180)
  })
  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER])('rejects unsafe money %s', (amount) => {
    expect(() => calculateCheckoutTotals({ depositHeld: amount, creditHeld: 0, existingDebt: 0, finalChargesTotal: 0 })).toThrow()
  })
})

describe('checkout boundary validation', () => {
  const input = { actual_return_date: '2026-10-01', reason: 'Trả phòng', electricity: { reading: 500 } }
  it('accepts a real ISO date and metered handover', () => {
    expect(checkoutDraftSchema.safeParse(input).success).toBe(true)
  })
  it.each(['2026-02-30', '2026-13-01', '01/10/2026'])('rejects invalid calendar date %s', (date) => {
    expect(checkoutDraftSchema.safeParse({ ...input, actual_return_date: date }).success).toBe(false)
  })
  it('requires a reason when overriding consumption, including zero', () => {
    expect(checkoutDraftSchema.safeParse({ ...input, electricity: { reading: 0, usageOverride: 0 } }).success).toBe(false)
    expect(checkoutDraftSchema.safeParse({ ...input, electricity: { reading: 0, usageOverride: 0, reason: 'Đổi đồng hồ' } }).success).toBe(true)
  })
  it('rejects client-supplied totals', () => {
    expect(checkoutConfirmSchema.safeParse({ operation_id: 'a', snapshot_hash: 'abc', amount: 42 }).success).toBe(false)
  })
  it('rejects zero or fractional refunds', () => {
    const refund = { operation_id: 'dc7a4269-7888-4fa8-8a23-30d36431af37', paid_at: '2026-10-01', payment_method: 'Chuyển khoản' }
    expect(checkoutRefundSchema.safeParse({ ...refund, amount: 0 }).success).toBe(false)
    expect(checkoutRefundSchema.safeParse({ ...refund, amount: 1.5 }).success).toBe(false)
  })
  it('requires a reason for each waived final line', () => {
    const input = { expected_updated_at: '2026-10-01T00:00:00Z', modes: { rent: { mode: 'waived', reason: '' } } }
    expect(checkoutChargeModesSchema.safeParse(input).success).toBe(false)
    expect(checkoutChargeModesSchema.safeParse({ ...input, modes: { rent: { mode: 'waived', reason: 'Đã thỏa thuận miễn thu' } } }).success).toBe(true)
  })
})
