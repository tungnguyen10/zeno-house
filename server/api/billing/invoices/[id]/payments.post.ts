import { InvoicePaymentService } from '../../../../services/billing/payments'
import { invoicePaymentCreateSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã hoá đơn')

  const body = await readBody(event)
  const parsed = invoicePaymentCreateSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const result = await InvoicePaymentService.record(event, user, id!, parsed.data)
  setResponseStatus(event, 201)
  return { data: result }
})
