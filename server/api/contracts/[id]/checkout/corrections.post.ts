import { CheckoutService } from '../../../../services/checkout'
import { checkoutCorrectionSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutCorrectionSchema)
  return { data: await CheckoutService.correct(event, user, getRouterParam(event, 'id')!, input) }
})
