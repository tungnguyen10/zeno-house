import { BillingIncidentalChargeService } from '../../../../../services/billing/incidental-charges'
import { incidentalChargeUpdateSchema } from '~/utils/validators/billing'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const chargeId = getRouterParam(event, 'chargeId')
  if (!id || !chargeId) throwValidationError('Thiếu mã khoản phát sinh')
  const input = await parseBody(event, incidentalChargeUpdateSchema)
  const charge = await BillingIncidentalChargeService.update(event, user, id, chargeId, input)
  return { data: charge }
})
