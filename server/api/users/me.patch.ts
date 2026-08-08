import { userProfileUpdateSchema } from '~/utils/validators/users'
import { UserProfileService } from '../../services/users/profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, userProfileUpdateSchema, 'Hồ sơ cập nhật không hợp lệ')
  return { data: await UserProfileService.updateFullName(event, user, input.full_name) }
})
