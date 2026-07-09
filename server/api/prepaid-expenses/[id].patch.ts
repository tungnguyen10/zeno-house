import { PrepaidExpenseService } from '../../services/operations-report/prepaid-expenses'
import { prepaidExpenseUpdateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, prepaidExpenseUpdateSchema)

  const data = await PrepaidExpenseService.update(event, user, id, input)
  return { data }
})
