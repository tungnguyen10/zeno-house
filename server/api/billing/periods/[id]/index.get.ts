import { BillingPeriodService } from '../../../../services/billing/periods'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const period = await BillingPeriodService.getById(event, user, id!)
  return { data: period }
})
