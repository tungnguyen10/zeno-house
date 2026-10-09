import { CheckoutService } from '../../../../services/checkout'
import { checkoutChargeSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutChargeSchema)
  return { data: await CheckoutService.charge(event, user, getRouterParam(event, 'id')!, input) }
})
