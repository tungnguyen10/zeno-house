import { RecurringExpenseService } from '../../../services/operations-report/recurring-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const data = await RecurringExpenseService.dismiss(event, user, id)
  return { data }
})
