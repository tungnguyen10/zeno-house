import { CheckoutService } from '../../../../services/checkout'
import { checkoutCreditSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutCreditSchema)
  return { data: await CheckoutService.credit(event, user, getRouterParam(event, 'id')!, input) }
})
