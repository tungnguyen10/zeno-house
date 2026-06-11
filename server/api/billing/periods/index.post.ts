import { BillingPeriodService } from '../../../services/billing/periods'
import { billingPeriodOpenSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const parsed = billingPeriodOpenSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu không hợp lệ', parsed.error.flatten())
  }

  const period = await BillingPeriodService.openOrGet(event, user, parsed.data)

  setResponseStatus(event, 201)
  return { data: period }
})
