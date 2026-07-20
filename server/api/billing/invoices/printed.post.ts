import { InvoicePrintService } from '../../../services/billing/invoice-print'
import { invoicePrintRequestSchema } from '~/utils/validators/invoices'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, invoicePrintRequestSchema)
  const result = await InvoicePrintService.recordPrinted(event, user, input.invoice_ids)
  return { data: result }
})
