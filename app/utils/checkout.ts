/** Exact ledger arithmetic. Only calculated utility lines are rounded, before this boundary. */
export function calculateCheckoutTotals(input: {
  depositHeld: number
  creditHeld: number
  existingDebt: number
  finalChargesTotal: number
}) {
  for (const value of Object.values(input)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 999_999_999_999) {
      throw new Error('Invalid checkout money')
    }
  }
  const totalDue = input.existingDebt + input.finalChargesTotal
  const creditApplied = Math.min(input.creditHeld, totalDue)
  const depositApplied = Math.min(input.depositHeld, totalDue - creditApplied)
  return {
    totalDue,
    creditApplied,
    depositApplied,
    refundDue: input.depositHeld + input.creditHeld - creditApplied - depositApplied,
    additionalDue: totalDue - creditApplied - depositApplied,
  }
}
