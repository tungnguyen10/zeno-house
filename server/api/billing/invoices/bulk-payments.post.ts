import { InvoicePaymentService } from '../../../services/billing/payments'
import { bulkPaymentsBodySchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, bulkPaymentsBodySchema)

  const result = await InvoicePaymentService.recordBatch(event, user, input)
  setResponseStatus(event, 201)
  return { data: result }
})
