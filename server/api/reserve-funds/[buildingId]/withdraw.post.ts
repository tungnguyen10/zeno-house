import { ReserveFundService } from '../../../services/operations-report/reserve-funds'
import {
  reserveFundMovementSchema,
  reserveFundParamsSchema,
} from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const params = reserveFundParamsSchema.safeParse({
    buildingId: getRouterParam(event, 'buildingId'),
  })
  if (!params.success) throwValidationError('Dữ liệu không hợp lệ', params.error.flatten())

  const body = await readBody(event)
  const result = reserveFundMovementSchema.safeParse(body)
  if (!result.success) throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())

  const fund = await ReserveFundService.withdraw(event, user, params.data.buildingId, result.data)
  setResponseStatus(event, 201)
  return { data: fund }
})
