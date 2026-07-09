import { invoiceListQuerySchema } from '~/utils/validators/invoices'
import { InvoiceQueryService } from '../../services/billing/invoice-query'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = parseQuery(event, invoiceListQuerySchema, 'Bộ lọc hoá đơn không hợp lệ')

  return InvoiceQueryService.list(event, user, input)
})
