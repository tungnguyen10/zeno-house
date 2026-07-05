import { RecurringExpenseService } from '../../services/operations-report/recurring-expenses'
import { recurringExpenseCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = recurringExpenseCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await RecurringExpenseService.create(event, user, result.data)
  setResponseStatus(event, 201)
  return { data }
})
