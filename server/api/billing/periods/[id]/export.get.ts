import { BillingExportService } from '../../../../services/billing/export'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const { buffer, fileName } = await BillingExportService.buildPeriodWorkbook(event, user, id!)

  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': String(buffer.length),
    'Cache-Control': 'no-store',
  })
  return buffer
})
