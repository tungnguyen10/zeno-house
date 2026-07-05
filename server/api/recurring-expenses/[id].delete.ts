import { RecurringExpenseService } from '../../services/operations-report/recurring-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  await RecurringExpenseService.delete(event, user, id)
  setResponseStatus(event, 204)
})
