import { TenantBootstrapService } from '../../services/tenant-portal/bootstrap'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  return { data: await TenantBootstrapService.get(event, user) }
})
