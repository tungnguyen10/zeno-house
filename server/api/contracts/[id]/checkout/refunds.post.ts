import { CheckoutService } from '../../../../services/checkout'
import { checkoutRefundSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutRefundSchema)
  return { data: await CheckoutService.refund(event, user, getRouterParam(event, 'id')!, input) }
})
