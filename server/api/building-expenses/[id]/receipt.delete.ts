import { BuildingExpenseService } from '../../../services/operations-report/expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const expense = await BuildingExpenseService.removeReceipt(event, user, id)
  return { data: expense }
})
