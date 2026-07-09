import { ReserveFundService } from '../../services/operations-report/reserve-funds'
import { reserveFundRateListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, reserveFundRateListQuerySchema, 'Tham số không hợp lệ')

  const rates = await ReserveFundService.listRates(event, user, input.building_id)
  return { data: rates }
})
