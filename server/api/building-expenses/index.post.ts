import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, buildingExpenseCreateSchema)

  const expense = await BuildingExpenseService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: expense }
})
