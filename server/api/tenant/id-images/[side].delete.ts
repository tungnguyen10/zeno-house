import { tenantIdentityImageSideSchema } from '~/utils/validators/tenant-portal'
import { TenantIdentityImageService } from '../../../services/tenant-portal/identity-images'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const sideResult = tenantIdentityImageSideSchema.safeParse(getRouterParam(event, 'side'))
  if (!sideResult.success) throwValidationError('Mặt ảnh định danh không hợp lệ')

  return { data: await TenantIdentityImageService.remove(event, user, sideResult.data) }
})
