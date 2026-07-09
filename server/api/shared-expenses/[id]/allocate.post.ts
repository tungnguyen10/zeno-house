import { SharedExpenseService } from '../../../services/shared-expenses'
import { sharedExpenseAllocateSchema } from '~/utils/validators/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, sharedExpenseAllocateSchema)

  const allocation = await SharedExpenseService.allocate(event, user, id, input)
  setResponseStatus(event, 201)
  return { data: allocation }
})
