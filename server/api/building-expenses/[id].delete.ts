import { BuildingExpenseService } from '../../services/operations-report/expenses'
import { buildingExpenseVoidSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  // Void reason is required; accept it from the request body.
  const input = await parseBody(event, buildingExpenseVoidSchema, 'Lý do hủy là bắt buộc')

  const expense = await BuildingExpenseService.void(event, user, id, input.void_reason)
  return { data: expense }
})
