import { BillingPeriodService } from '../../../services/billing/periods'
import { billingPeriodListQuerySchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const raw = getQuery(event)
  const parsed = billingPeriodListQuerySchema.safeParse(raw)
  if (!parsed.success) {
    throwValidationError('Tham số không hợp lệ', parsed.error.flatten())
  }

  const items = await BillingPeriodService.list(event, user, parsed.data)
  return { data: items, meta: { total: items.length } }
})
