import { ReserveFundService } from '../../services/operations-report/reserve-funds'
import { reserveFundRateUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, reserveFundRateUpdateSchema)

  const rate = await ReserveFundService.updateRate(event, user, id, input)
  return { data: rate }
})
