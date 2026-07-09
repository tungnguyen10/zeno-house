import { PrepaidExpenseService } from '../../services/operations-report/prepaid-expenses'
import { prepaidExpenseCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, prepaidExpenseCreateSchema)

  const data = await PrepaidExpenseService.create(event, user, input)
  setResponseStatus(event, 201)
  return { data }
})
