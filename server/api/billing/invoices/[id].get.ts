import { InvoiceService } from '../../../services/billing/invoices'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã hoá đơn')

  const result = await InvoiceService.getWithCharges(event, user, id!)
  return { data: result }
})
