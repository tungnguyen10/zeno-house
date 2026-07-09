import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, buildingExpenseUpdateSchema)

  const expense = await BuildingExpenseService.update(event, user, id, input)
  return { data: expense }
})
