import { BuildingFixedCostService } from '../../services/operations-report/fixed-costs'
import { buildingFixedCostCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = buildingFixedCostCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const fixedCost = await BuildingFixedCostService.create(event, user, result.data)

  setResponseStatus(event, 201)
  return { data: fixedCost }
})
