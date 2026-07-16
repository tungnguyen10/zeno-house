import { TenantProfileService } from '../../services/tenant-portal/profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  return { data: await TenantProfileService.get(event, user) }
})
