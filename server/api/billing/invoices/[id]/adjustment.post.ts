import { InvoiceService } from '../../../../services/billing/invoices'
import { adjustmentChargeSchema } from '~/utils/validators/billing'

/**
 * Add an adjustment charge to a target invoice. The route uses the target
 * invoice id from the URL and the body carries label/amount/reason.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã hoá đơn')

  const body = await readBody(event)
  const parsed = adjustmentChargeSchema.safeParse({ ...(body ?? {}), target_invoice_id: id })
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const result = await InvoiceService.addAdjustment(event, user, parsed.data)
  setResponseStatus(event, 201)
  return { data: result }
})
