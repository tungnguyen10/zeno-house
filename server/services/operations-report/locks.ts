import type { H3Event } from 'h3'
import { OperationsReportPeriodRepository } from '../../repositories/operations-report/periods'

export const OperationsReportLockService = {
  async assertReportOpen(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<void> {
    if (await OperationsReportPeriodRepository.isClosed(event, buildingId, periodYear, periodMonth)) {
      throwConflict('Báo cáo vận hành đã chốt, cần mở lại trước khi chỉnh sửa')
    }
  },

  async assertNoClosedReportsInRange(
    event: H3Event,
    buildingId: string,
    fromYear: number,
    fromMonth: number,
    toYear: number | null,
    toMonth: number | null,
  ): Promise<void> {
    const closed = await OperationsReportPeriodRepository.listClosedInRange(
      event,
      buildingId,
      fromYear,
      fromMonth,
      toYear,
      toMonth,
    )
    if (closed.length > 0) {
      throwConflict('Thay đổi này ảnh hưởng báo cáo vận hành đã chốt')
    }
  },
}
