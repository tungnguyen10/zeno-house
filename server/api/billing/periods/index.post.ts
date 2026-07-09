import { BillingPeriodService } from '../../../services/billing/periods'
import { billingPeriodOpenSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, billingPeriodOpenSchema)

  const period = await BillingPeriodService.openOrGet(event, user, input)

  setResponseStatus(event, 201)
  return { data: period }
})
