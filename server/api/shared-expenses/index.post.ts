import { SharedExpenseService } from '../../services/shared-expenses'
import { sharedExpenseCreateSchema } from '~/utils/validators/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const result = sharedExpenseCreateSchema.safeParse(body)
  if (!result.success) throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())

  const item = await SharedExpenseService.create(event, user, result.data)
  setResponseStatus(event, 201)
  return { data: item }
})
