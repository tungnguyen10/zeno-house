import { OperationsReportService } from '../../services/operations-report/report'
import { operationsReportQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = operationsReportQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError('Tham số không hợp lệ', result.error.flatten())
  }

  const report = await OperationsReportService.getReport(event, user, result.data)
  return { data: report }
})
