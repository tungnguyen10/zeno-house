import { OperationsReportService } from '../../services/operations-report/report'
import { operationsReportCloseSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const result = operationsReportCloseSchema.safeParse(await readBody(event))
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const closure = await OperationsReportService.close(event, user, result.data)
  return { data: closure }
})
