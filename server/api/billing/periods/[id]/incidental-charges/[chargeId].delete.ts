import { BillingIncidentalChargeService } from '../../../../../services/billing/incidental-charges'
import { incidentalChargeDeleteSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const chargeId = getRouterParam(event, 'chargeId')
  if (!id || !chargeId) throwValidationError('Thiếu mã khoản phát sinh')
  const input = await parseBody(event, incidentalChargeDeleteSchema)
  const charge = await BillingIncidentalChargeService.remove(event, user, id, chargeId, input)
  return { data: charge }
})
