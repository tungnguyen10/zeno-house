import { ReserveFundService } from '../../services/operations-report/reserve-funds'
import { reserveFundRateCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = reserveFundRateCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const rate = await ReserveFundService.createRate(event, user, result.data)
  setResponseStatus(event, 201)
  return { data: rate }
})
