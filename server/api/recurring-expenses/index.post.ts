import { RecurringExpenseService } from '../../services/operations-report/recurring-expenses'
import { recurringExpenseCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, recurringExpenseCreateSchema)

  const data = await RecurringExpenseService.create(event, user, input)
  setResponseStatus(event, 201)
  return { data }
})
