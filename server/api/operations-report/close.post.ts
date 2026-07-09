import { OperationsReportService } from '../../services/operations-report/report'
import { operationsReportCloseSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, operationsReportCloseSchema)

  const closure = await OperationsReportService.close(event, user, input)
  return { data: closure }
})
