import { UserManagementService } from '../../services/users'
import { userUpdateSchema } from '~/utils/validators/users'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, userUpdateSchema, 'Dữ liệu người dùng không hợp lệ')

  return { data: await UserManagementService.updateUser(event, user, id, input) }
})
