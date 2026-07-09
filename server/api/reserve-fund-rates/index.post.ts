import { ReserveFundService } from '../../services/operations-report/reserve-funds'
import { reserveFundRateCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, reserveFundRateCreateSchema)

  const rate = await ReserveFundService.createRate(event, user, input)
  setResponseStatus(event, 201)
  return { data: rate }
})
