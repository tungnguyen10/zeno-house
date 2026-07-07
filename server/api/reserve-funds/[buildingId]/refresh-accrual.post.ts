import { OperationsReportService } from '../../../services/operations-report/report'
import {
  reserveFundParamsSchema,
  reserveFundRefreshAccrualSchema,
} from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const params = reserveFundParamsSchema.safeParse(event.context.params ?? {})
  if (!params.success) {
    throwValidationError('Tham số không hợp lệ', params.error.flatten())
  }
  const body = reserveFundRefreshAccrualSchema.safeParse(await readBody(event))
  if (!body.success) {
    throwValidationError('Dữ liệu không hợp lệ', body.error.flatten())
  }

  const transaction = await OperationsReportService.refreshReserveAccrual(event, user, {
    building_id: params.data.buildingId,
    period_year: body.data.period_year,
    period_month: body.data.period_month,
  })
  return { data: transaction }
})
