import { SharedExpenseService } from '../../../services/shared-expenses'
import { sharedExpenseAllocateSchema } from '~/utils/validators/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const result = sharedExpenseAllocateSchema.safeParse(body)
  if (!result.success) throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())

  const allocation = await SharedExpenseService.allocate(event, user, id, result.data)
  setResponseStatus(event, 201)
  return { data: allocation }
})
