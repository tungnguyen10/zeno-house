import { BillingUtilityUsageService } from '../../../../services/billing/utility-usages'
import { utilityUsageOverrideSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const body = await readBody(event)
  const parsed = utilityUsageOverrideSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const usage = await BillingUtilityUsageService.saveOverride(event, user, id!, parsed.data)

  setResponseStatus(event, 201)
  return { data: usage }
})
