import { TenantSupportRequestService } from '../../../services/tenant-portal/requests'
import { tenantSupportRequestListQuerySchema } from '~/utils/validators/tenant-support-requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const query = parseQuery(event, tenantSupportRequestListQuerySchema)
  return TenantSupportRequestService.list(event, user, query)
})
