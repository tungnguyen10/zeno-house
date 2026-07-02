import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseVoidSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  // Void reason is required; accept it from the request body.
  const body = await readBody(event).catch(() => ({}))
  const result = buildingExpenseVoidSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Lý do hủy là bắt buộc', result.error.flatten())
  }

  const expense = await BuildingExpenseService.void(event, user, id, result.data.void_reason)
  return { data: expense }
})
