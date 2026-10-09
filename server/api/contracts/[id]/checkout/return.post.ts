import { CheckoutService } from '../../../../services/checkout'
import { checkoutReturnSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutReturnSchema)
  return { data: await CheckoutService.returnRoom(event, user, getRouterParam(event, 'id')!, input) }
})
