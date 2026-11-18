import { BuildingOtherIncomeService } from '../../services/operations-report/other-incomes'
import { buildingOtherIncomeUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, buildingOtherIncomeUpdateSchema)
  const income = await BuildingOtherIncomeService.update(event, user, id, input)
  return { data: income }
})
