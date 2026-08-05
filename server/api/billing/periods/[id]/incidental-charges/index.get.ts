import { BillingIncidentalChargeService } from '../../../../../services/billing/incidental-charges'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')
  const items = await BillingIncidentalChargeService.list(event, user, id)
  return { data: items, meta: { total: items.length } }
})
