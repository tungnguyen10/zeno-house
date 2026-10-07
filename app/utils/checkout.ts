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

const checkoutBlockers: Record<string, string> = {
  CHECKOUT_DRAFT_REQUIRED: 'Cần lưu hồ sơ bàn giao trước khi xem bảng tính.',
  CHECKOUT_PERIOD_CLOSED: 'Kỳ hóa đơn đã đóng; phần tiền chờ đối soát trước khi phát hành.',
  CHECKOUT_ELECTRICITY_READING_REQUIRED: 'Thiếu chỉ số điện cuối.',
  CHECKOUT_WATER_READING_REQUIRED: 'Thiếu chỉ số nước cuối.',
  CHECKOUT_ELECTRICITY_BASELINE_REQUIRED: 'Thiếu mốc điện đã tính tiền hoặc chỉ số đầu kỳ được xác nhận.',
  CHECKOUT_WATER_BASELINE_REQUIRED: 'Thiếu mốc nước đã tính tiền hoặc chỉ số đầu kỳ được xác nhận.',
  CHECKOUT_RATE_REQUIRED: 'Thiếu giá điện, nước hoặc dịch vụ tại thời điểm trả phòng.',
  CHECKOUT_USAGE_INVALID: 'Chỉ số hoặc lượng dùng điều chỉnh chưa hợp lệ.',
  CHECKOUT_INVOICE_TOTALS_INCONSISTENT: 'Tổng hóa đơn và khoản đã thu chưa khớp; cần đối soát trước.',
  CHECKOUT_NEGATIVE_FINAL_TOTAL: 'Tổng khoản cuối âm; cần điều chỉnh giảm giá hoặc đối soát thủ công.',
  CHECKOUT_DISCOUNT_REQUIRES_CORRECTION: 'Tiền phòng đã lập hóa đơn nhưng khoản giảm giá chưa có. Dùng luồng điều chỉnh hóa đơn để đối soát.',
  CHECKOUT_TIERED_UNSUPPORTED: 'Giá điện bậc thang cần đối soát thủ công trước khi phát hành tiền tháng cuối.',
  CHECKOUT_CHARGE_MODE_INVALID: 'Cách tính một khoản chưa hợp lệ.',
}

export function checkoutBlockerMessage(code: string): string {
  return checkoutBlockers[code] ?? code
}
