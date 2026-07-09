import { BuildingFixedCostService } from '../../services/operations-report/fixed-costs'
import { buildingFixedCostListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, buildingFixedCostListQuerySchema, 'Tham số không hợp lệ')

  const fixedCosts = await BuildingFixedCostService.list(event, user, input.building_id)
  return { data: fixedCosts }
})
