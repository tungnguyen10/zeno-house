import { InvoicePaymentService } from '../../../services/billing/payments'
import { bulkPaymentsBodySchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const parsed = bulkPaymentsBodySchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const result = await InvoicePaymentService.recordBatch(event, user, parsed.data)
  setResponseStatus(event, 201)
  return { data: result }
})
