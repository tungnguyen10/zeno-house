import { BillingItemService } from '../../../services/billing-items'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const detail = await BillingItemService.getItemDetail(event, user, id)
  return { data: detail }
})
