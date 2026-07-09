import { InvoiceService } from '../../../../services/billing/invoices'
import { voidInvoiceSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã hoá đơn')

  const input = await parseBody(event, voidInvoiceSchema)

  const invoice = await InvoiceService.voidInvoice(event, user, id!, input)
  return { data: invoice }
})
