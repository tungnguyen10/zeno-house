import { BillingPeriodService } from '../../../../services/billing/periods'
import { billingPeriodReopenSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const input = await parseBody(event, billingPeriodReopenSchema)

  const result = await BillingPeriodService.reopen(event, user, id!, input.reason)
  return { data: result }
})
