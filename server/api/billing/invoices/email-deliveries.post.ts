import { invoiceEmailEnqueueSchema } from '~/utils/validators/invoice-email'
import { InvoiceEmailDeliveryService } from '../../../services/invoice-email/deliveries'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = invoiceEmailEnqueueSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throwValidationError('Danh sách hoá đơn không hợp lệ', parsed.error.flatten())
  }
  return {
    data: await InvoiceEmailDeliveryService.enqueue(event, user, parsed.data.invoice_ids),
  }
})
