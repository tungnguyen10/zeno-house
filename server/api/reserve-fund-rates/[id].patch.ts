import { ReserveFundService } from '../../services/operations-report/reserve-funds'
import { reserveFundRateUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = reserveFundRateUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const rate = await ReserveFundService.updateRate(event, user, id, result.data)
  return { data: rate }
})
