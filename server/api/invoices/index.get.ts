import { invoiceListQuerySchema } from '~/utils/validators/invoices'
import { InvoiceQueryService } from '../../services/billing/invoice-query'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = invoiceListQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throwValidationError('Bộ lọc hoá đơn không hợp lệ', parsed.error.flatten())
  }

  return InvoiceQueryService.list(event, user, parsed.data)
})
