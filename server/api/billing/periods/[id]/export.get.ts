import { BillingExportService } from '../../../../services/billing/export'
import { setXlsxResponse } from '../../../../utils/excel'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const { buffer, fileName } = await BillingExportService.buildPeriodWorkbook(event, user, id!)

  setXlsxResponse(event, buffer, fileName)
  return buffer
})
