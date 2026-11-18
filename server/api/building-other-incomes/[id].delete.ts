import { BuildingOtherIncomeService } from '../../services/operations-report/other-incomes'
import { buildingOtherIncomeVoidSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, buildingOtherIncomeVoidSchema)
  const income = await BuildingOtherIncomeService.void(event, user, id, input)
  return { data: income }
})
