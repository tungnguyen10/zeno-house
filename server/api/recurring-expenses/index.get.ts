import { RecurringExpenseService } from '../../services/operations-report/recurring-expenses'
import { recurringExpenseListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, recurringExpenseListQuerySchema, 'Tham số không hợp lệ')

  const upcomingOnly = getQuery(event).upcoming === 'true'
  const data = upcomingOnly
    ? await RecurringExpenseService.listUpcoming(event, user, input)
    : await RecurringExpenseService.list(event, user, input)
  return { data }
})
