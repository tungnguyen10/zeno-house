import { BillingPeriodService } from '../../../../services/billing/periods'
import { billingPeriodReopenSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const body = await readBody(event)
  const parsed = billingPeriodReopenSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const result = await BillingPeriodService.reopen(event, user, id!, parsed.data.reason)
  return { data: result }
})
