import { BillingUtilityUsageService } from '../../../../services/billing/utility-usages'
import { utilityUsageOverrideSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const input = await parseBody(event, utilityUsageOverrideSchema)

  const usage = await BillingUtilityUsageService.saveOverride(event, user, id!, input)

  setResponseStatus(event, 201)
  return { data: usage }
})
