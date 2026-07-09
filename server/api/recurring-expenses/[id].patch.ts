import { RecurringExpenseService } from '../../services/operations-report/recurring-expenses'
import { recurringExpenseUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, recurringExpenseUpdateSchema)

  const data = await RecurringExpenseService.update(event, user, id, input)
  return { data }
})
