import { BillingPeriodService } from '../../../../services/billing/periods'
import { billingPeriodUnissueSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const body = await readBody(event)
  const parsed = billingPeriodUnissueSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const result = await BillingPeriodService.unissue(event, user, id!, parsed.data.reason)
  return { data: result }
})
