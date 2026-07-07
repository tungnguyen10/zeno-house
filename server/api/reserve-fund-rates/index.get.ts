import { ReserveFundService } from '../../services/operations-report/reserve-funds'
import { reserveFundRateListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = reserveFundRateListQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError('Tham số không hợp lệ', result.error.flatten())
  }

  const rates = await ReserveFundService.listRates(event, user, result.data.building_id)
  return { data: rates }
})
