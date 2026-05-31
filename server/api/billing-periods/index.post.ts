import { BillingPeriodService } from '../../services/billing-periods'
import { billingPeriodCreateSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  const result = billingPeriodCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const { building_id, year, month } = result.data
  const period = await BillingPeriodService.getOrCreate(event, user, building_id, year, month)

  setResponseStatus(event, 200)
  return { data: period }
})
