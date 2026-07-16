import { TenantIdentityImageService } from '../../../services/tenant-portal/identity-images'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  return { data: await TenantIdentityImageService.get(event, user) }
})
