import { BillingDraftService } from '../../../../services/billing/drafts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã kỳ vận hành')

  const result = await BillingDraftService.calculateDraft(event, user, id!)
  return { data: result }
})
