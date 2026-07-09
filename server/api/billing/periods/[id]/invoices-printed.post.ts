import { BillingExportService } from '../../../../services/billing/export'
import { invoicesPrintedSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const input = await parseBody(event, invoicesPrintedSchema)

  const result = await BillingExportService.recordInvoicesPrinted(
    event, user, id!, input.invoice_ids,
  )
  return { data: result }
})
