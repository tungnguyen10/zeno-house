import { PrepaidExpenseService } from '../../services/operations-report/prepaid-expenses'
import { prepaidExpenseListQuerySchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = parseQuery(event, prepaidExpenseListQuerySchema, 'Tham số không hợp lệ')

  const data = await PrepaidExpenseService.list(event, user, input)
  return { data }
})
