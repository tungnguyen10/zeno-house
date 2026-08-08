import { UserProfileService } from '../../services/users/profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await UserProfileService.get(event, user) }
})
