import { OperationsReportExportService } from '../../services/operations-report/export'
import { setXlsxResponse } from '../../utils/excel'
import { operationsReportQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = operationsReportQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError('Tham số không hợp lệ', result.error.flatten())
  }

  const { buffer, fileName } = await OperationsReportExportService.buildWorkbook(event, user, result.data)
  setXlsxResponse(event, buffer, fileName)
  return buffer
})
