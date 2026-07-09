import { InvoicePaymentService } from '../../../../services/billing/payments'
import { invoicePaymentCreateSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã hoá đơn')

  const input = await parseBody(event, invoicePaymentCreateSchema)

  const result = await InvoicePaymentService.record(event, user, id!, input)
  setResponseStatus(event, 201)
  return { data: result }
})
