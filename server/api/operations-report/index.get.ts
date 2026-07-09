import { OperationsReportService } from '../../services/operations-report/report'
import { operationsReportQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, operationsReportQuerySchema, 'Tham số không hợp lệ')

  const report = await OperationsReportService.getReport(event, user, input)
  return { data: report }
})
