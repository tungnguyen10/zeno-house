import { OperationsReportService } from '../../services/operations-report/report'
import { operationsReportReopenSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, operationsReportReopenSchema)

  const closure = await OperationsReportService.reopen(event, user, input)
  return { data: closure }
})
