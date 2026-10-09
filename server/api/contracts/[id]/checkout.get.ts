import { CheckoutService } from '../../../services/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await CheckoutService.get(event, user, getRouterParam(event, 'id')!) }
})
