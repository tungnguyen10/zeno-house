import { readMultipartFormData } from 'h3'
import { UserProfileService } from '../../../services/users/profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'avatar' && part.data.length > 0)
  if (!file) throwValidationError('Thiếu tệp ảnh đại diện')

  const profile = await UserProfileService.uploadAvatar(event, user, {
    mimeType: file.type ?? '',
    data: file.data,
  })
  return { data: profile }
})
