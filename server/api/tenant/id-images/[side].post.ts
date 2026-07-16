import { readMultipartFormData } from 'h3'
import { tenantIdentityImageSideSchema } from '~/utils/validators/tenant-portal'
import { TenantIdentityImageService } from '../../../services/tenant-portal/identity-images'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const sideResult = tenantIdentityImageSideSchema.safeParse(getRouterParam(event, 'side'))
  if (!sideResult.success) throwValidationError('Mặt ảnh định danh không hợp lệ')

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'image' && part.data.length > 0)
  if (!file) throwValidationError('Thiếu tệp ảnh định danh')

  const images = await TenantIdentityImageService.upload(event, user, sideResult.data, {
    mimeType: file.type ?? '',
    data: file.data,
  })
  return { data: images }
})
