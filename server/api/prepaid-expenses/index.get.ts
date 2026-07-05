import { PrepaidExpenseService } from '../../services/operations-report/prepaid-expenses'
import { prepaidExpenseListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const result = prepaidExpenseListQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError('Tham số không hợp lệ', result.error.flatten())
  }

  const data = await PrepaidExpenseService.list(event, user, result.data)
  return { data }
})
