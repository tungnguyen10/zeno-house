import { CheckoutService } from '../../../../services/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await CheckoutService.preview(event, user, getRouterParam(event, 'id')!) }
})
