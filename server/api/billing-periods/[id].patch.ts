import { BillingPeriodService } from '../../services/billing-periods'
import { billingPeriodUpdateSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const result = billingPeriodUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const { action } = result.data
  const period =
    action === 'finalize'
      ? await BillingPeriodService.finalize(event, user, id)
      : await BillingPeriodService.unlock(event, user, id)

  return { data: period }
})
