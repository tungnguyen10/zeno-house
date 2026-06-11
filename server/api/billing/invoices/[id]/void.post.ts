import { InvoiceService } from '../../../../services/billing/invoices'
import { voidInvoiceSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã hoá đơn')

  const body = await readBody(event)
  const parsed = voidInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const invoice = await InvoiceService.voidInvoice(event, user, id!, parsed.data)
  return { data: invoice }
})
