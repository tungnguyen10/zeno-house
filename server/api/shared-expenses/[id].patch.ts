import { SharedExpenseService } from '../../services/shared-expenses'
import { sharedExpenseUpdateSchema } from '~/utils/validators/shared-expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const result = sharedExpenseUpdateSchema.safeParse(body)
  if (!result.success) throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())

  const item = await SharedExpenseService.update(event, user, id, result.data)
  return { data: item }
})
