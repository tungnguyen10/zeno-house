import { invoiceEmailResendSchema } from '~/utils/validators/invoice-email'
import { InvoiceEmailDeliveryService } from '../../../../../services/invoice-email/deliveries'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã hoá đơn')
  const input = await parseBody(event, invoiceEmailResendSchema)
  return { data: await InvoiceEmailDeliveryService.resend(event, user, id, input) }
})