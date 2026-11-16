export interface PaymentWindow {
  startDay: number
  endDay: number
  graceDays: number
  overdueDay: number | null
  sentence: string
}

export function formatPaymentWindow(building: {
  billingGenerationDay: number | null
  paymentDueDay: number | null
  gracePeriodDays: number
}): PaymentWindow | null {
  const { billingGenerationDay: startDay, paymentDueDay: endDay } = building
  if (startDay == null || endDay == null) return null
  const graceDays = building.gracePeriodDays ?? 0
  const candidate = endDay + graceDays
  const overdueDay = candidate <= 31 ? candidate : null
  const tail = overdueDay !== null
    ? `sau ngày ${overdueDay} không thanh toán, Bên A có quyền chấm dứt hợp đồng.`
    : `quá ${graceDays} ngày sau hạn thanh toán, Bên A có quyền chấm dứt hợp đồng.`
  return {
    startDay,
    endDay,
    graceDays,
    overdueDay,
    sentence: `Thanh toán từ ngày ${startDay} đến ngày ${endDay} hằng tháng; ${tail}`,
  }
}
