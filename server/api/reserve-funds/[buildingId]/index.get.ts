import { ReserveFundService } from '../../../services/operations-report/reserve-funds'
import { reserveFundParamsSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const params = reserveFundParamsSchema.safeParse({
    buildingId: getRouterParam(event, 'buildingId'),
  })
  if (!params.success) throwValidationError('Dữ liệu không hợp lệ', params.error.flatten())

  const fund = await ReserveFundService.get(event, user, params.data.buildingId)
  return { data: fund }
})
