import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, buildingExpenseListQuerySchema, 'Tham số không hợp lệ')

  const expenses = await BuildingExpenseService.list(event, user, input)
  return { data: expenses }
})
