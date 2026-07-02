import { BuildingFixedCostService } from '../../services/operations-report/fixed-costs'
import { buildingFixedCostUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = buildingFixedCostUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const fixedCost = await BuildingFixedCostService.update(event, user, id, result.data)
  return { data: fixedCost }
})
