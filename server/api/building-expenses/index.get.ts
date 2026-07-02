import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = buildingExpenseListQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError('Tham số không hợp lệ', result.error.flatten())
  }

  const expenses = await BuildingExpenseService.list(event, user, result.data)
  return { data: expenses }
})
