import { BillingDraftGridService } from '../../../../services/billing/grid'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const result = await BillingDraftGridService.getGrid(event, user, id!)
  return { data: result }
})
