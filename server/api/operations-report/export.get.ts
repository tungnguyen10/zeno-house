import { OperationsReportExportService } from '../../services/operations-report/export'
import { setXlsxResponse } from '../../utils/excel'
import { operationsReportQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, operationsReportQuerySchema, 'Tham số không hợp lệ')

  const { buffer, fileName } = await OperationsReportExportService.buildWorkbook(event, user, input)
  setXlsxResponse(event, buffer, fileName)
  return buffer
})
