import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = buildingExpenseUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const expense = await BuildingExpenseService.update(event, user, id, result.data)
  return { data: expense }
})
