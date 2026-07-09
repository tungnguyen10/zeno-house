import { BillingPeriodService } from '../../../services/billing/periods'
import { billingPeriodListQuerySchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, billingPeriodListQuerySchema, 'Tham số không hợp lệ')

  const items = await BillingPeriodService.list(event, user, input)
  return { data: items, meta: { total: items.length } }
})
