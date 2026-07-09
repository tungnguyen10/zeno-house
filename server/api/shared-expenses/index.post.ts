import { SharedExpenseService } from '../../services/shared-expenses'
import { sharedExpenseCreateSchema } from '~/utils/validators/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, sharedExpenseCreateSchema)

  const item = await SharedExpenseService.create(event, user, input)
  setResponseStatus(event, 201)
  return { data: item }
})
