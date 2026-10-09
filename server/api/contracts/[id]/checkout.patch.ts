import { CheckoutService } from '../../../services/checkout'
import { checkoutDraftSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutDraftSchema)
  return { data: await CheckoutService.save(event, user, getRouterParam(event, 'id')!, input) }
})
