import { RecurringExpenseService } from '../../services/operations-report/recurring-expenses'
import { recurringExpenseUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = recurringExpenseUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await RecurringExpenseService.update(event, user, id, result.data)
  return { data }
})
