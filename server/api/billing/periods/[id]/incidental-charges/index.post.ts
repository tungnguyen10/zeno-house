import { BillingIncidentalChargeService } from '../../../../../services/billing/incidental-charges'
import { incidentalChargeCreateSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')
  const input = await parseBody(event, incidentalChargeCreateSchema)
  const charge = await BillingIncidentalChargeService.create(event, user, id, input)
  setResponseStatus(event, 201)
  return { data: charge }
})
