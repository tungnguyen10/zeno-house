import { PrepaidExpenseService } from '../../services/operations-report/prepaid-expenses'
import { prepaidExpenseCreateSchema } from '~/utils/validators/operations-report'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = prepaidExpenseCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await PrepaidExpenseService.create(event, user, result.data)
  setResponseStatus(event, 201)
  return { data }
})
