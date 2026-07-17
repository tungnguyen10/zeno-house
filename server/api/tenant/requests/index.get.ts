import { TenantSupportRequestService } from '../../../services/tenant-portal/requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  return { data: await TenantSupportRequestService.list(event, user) }
})
