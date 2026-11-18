import { BuildingOtherIncomeService } from '../../services/operations-report/other-incomes'
import { buildingOtherIncomeCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, buildingOtherIncomeCreateSchema)
  const income = await BuildingOtherIncomeService.create(event, user, input)
  setResponseStatus(event, 201)
  return { data: income }
})
