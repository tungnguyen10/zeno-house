import { BuildingFixedCostService } from '../../services/operations-report/fixed-costs'
import { buildingFixedCostCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, buildingFixedCostCreateSchema)

  const fixedCost = await BuildingFixedCostService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: fixedCost }
})
