import { CheckoutService } from '../../../../services/checkout'
import { checkoutChargeModesSchema } from '~/utils/validators/checkout'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, checkoutChargeModesSchema)
  return { data: await CheckoutService.saveChargeModes(event, user, getRouterParam(event, 'id')!, input) }
})
