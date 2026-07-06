import { BillingUtilityUsageService } from '../../../../../../services/billing/utility-usages'
import type { BillingUtilityUsage } from '~/types/billing'

export default defineEventHandler(async (event): Promise<{ data: BillingUtilityUsage }> => {
  const user = await requireAuth(event)
  const periodId = getRouterParam(event, 'id')
  const overrideId = getRouterParam(event, 'override_id')

  if (!periodId) throwValidationError('Thiếu mã kỳ vận hành')
  if (!overrideId) throwValidationError('Thiếu mã điều chỉnh')

  const approved = await BillingUtilityUsageService.approveOverride(
    event,
    user,
    periodId,
    overrideId,
  )

  return { data: approved }
})
