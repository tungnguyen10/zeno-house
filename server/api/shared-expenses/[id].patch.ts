import { SharedExpenseService } from '../../services/shared-expenses'
import { sharedExpenseUpdateSchema } from '~/utils/validators/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, sharedExpenseUpdateSchema)

  const item = await SharedExpenseService.update(event, user, id, input)
  return { data: item }
})
