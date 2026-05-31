import { BillingItemService } from '../../services/billing-items'
import { billingBulkPaymentSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  const result = billingBulkPaymentSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const { ids, status, paid_by, payment_method, payment_note } = result.data
  await BillingItemService.bulkUpdatePaymentStatus(event, user, ids, status, {
    paid_by,
    payment_method,
    payment_note,
  })

  return { data: { updated: ids.length } }
})
