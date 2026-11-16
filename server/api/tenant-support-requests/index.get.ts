import { TenantSupportRequestOperatorService } from '../../services/tenant-portal/operator-requests'
import { tenantSupportRequestQueueQuerySchema } from '~/utils/validators/tenant-support-requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = await parseQuery(event, tenantSupportRequestQueueQuerySchema)
  return TenantSupportRequestOperatorService.list(event, user, query)
})
