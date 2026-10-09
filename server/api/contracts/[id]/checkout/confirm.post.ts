import { CheckoutService } from '../../../../services/checkout'
import { checkoutConfirmSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutConfirmSchema)
  return { data: await CheckoutService.confirm(event, user, getRouterParam(event, 'id')!, input) }
})
