import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = buildingExpenseCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const expense = await BuildingExpenseService.create(event, user, result.data)

  setResponseStatus(event, 201)
  return { data: expense }
})
