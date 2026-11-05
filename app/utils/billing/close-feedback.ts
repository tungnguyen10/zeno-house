import type { BillingAccrualStatus } from '~/types/billing'

export interface ClosePeriodFeedback {
  kind: 'success' | 'warning'
  message: string
}

export function closePeriodFeedback(accrualStatus: BillingAccrualStatus | null): ClosePeriodFeedback {
  if (accrualStatus === 'skipped_report_closed') {
    return {
      kind: 'warning',
      message: 'Báo cáo vận hành tháng này đã chốt. Quỹ dự phòng chưa được cập nhật theo kỳ billing; Admin cần làm mới quỹ.',
    }
  }
  return { kind: 'success', message: 'Đã chốt kỳ vận hành' }
}
