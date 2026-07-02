import { UserManagementService } from '../../services/users'
import { userCreateSchema } from '~/utils/validators/users'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const parsed = userCreateSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu người dùng không hợp lệ', parsed.error.flatten())
  }

  const created = await UserManagementService.createUser(event, user, parsed.data)
  setResponseStatus(event, 201)
  return { data: created }
})
