import { describe, expect, it } from 'vitest'
import { closePeriodFeedback } from '../../app/utils/billing/close-feedback'

describe('closePeriodFeedback', () => {
  it('reports plain success when the accrual was recorded', () => {
    expect(closePeriodFeedback('recorded')).toEqual({ kind: 'success', message: 'Đã chốt kỳ vận hành' })
  })

  it('reports plain success on a replayed close', () => {
    expect(closePeriodFeedback(null)).toEqual({ kind: 'success', message: 'Đã chốt kỳ vận hành' })
  })

  it('warns that the reserve fund was not updated when the operations report is closed', () => {
    expect(closePeriodFeedback('skipped_report_closed')).toEqual({
      kind: 'warning',
      message: 'Báo cáo vận hành tháng này đã chốt. Quỹ dự phòng chưa được cập nhật theo kỳ billing; Admin cần làm mới quỹ.',
    })
  })
})
