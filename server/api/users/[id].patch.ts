import { UserManagementService } from '../../services/users'
import { userUpdateSchema } from '~/utils/validators/users'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = userUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throwValidationError('Dữ liệu người dùng không hợp lệ', parsed.error.flatten())
  }

  return { data: await UserManagementService.updateUser(event, user, id, parsed.data) }
})
