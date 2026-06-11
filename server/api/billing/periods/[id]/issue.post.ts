import { InvoiceService } from '../../../../services/billing/invoices'
import { issueInvoicesSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const body = await readBody(event)
  const parsed = issueInvoicesSchema.safeParse(body ?? {})
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const result = await InvoiceService.issueInvoices(event, user, id!, parsed.data)
  return { data: result }
})
