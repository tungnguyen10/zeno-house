import { userPasswordChangeSchema } from '~/utils/validators/users'
import { UserPasswordService } from '../../../services/users/password'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, userPasswordChangeSchema, 'Dữ liệu mật khẩu không hợp lệ')
  await UserPasswordService.change(event, user, input)
  return { data: { success: true } }
})
