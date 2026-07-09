import { BuildingFixedCostService } from '../../services/operations-report/fixed-costs'
import { buildingFixedCostUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, buildingFixedCostUpdateSchema)

  const fixedCost = await BuildingFixedCostService.update(event, user, id, input)
  return { data: fixedCost }
})
