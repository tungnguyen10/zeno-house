import { RecurringExpenseService } from '../../services/operations-report/recurring-expenses'
import { recurringExpenseListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = recurringExpenseListQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError('Tham số không hợp lệ', result.error.flatten())
  }

  const upcomingOnly = getQuery(event).upcoming === 'true'
  const data = upcomingOnly
    ? await RecurringExpenseService.listUpcoming(event, user, result.data)
    : await RecurringExpenseService.list(event, user, result.data)
  return { data }
})
