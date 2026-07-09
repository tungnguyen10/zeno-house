import { UserManagementService } from '../../services/users'
import { userCreateSchema } from '~/utils/validators/users'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, userCreateSchema, 'Dữ liệu người dùng không hợp lệ')

  const created = await UserManagementService.createUser(event, user, input)
  setResponseStatus(event, 201)
  return { data: created }
})
