import { TenantService } from '../../services/tenants'
import { tenantBulkActionSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, tenantBulkActionSchema)

  const data = await TenantService.bulkAction(event, user, input)
  return { data }
})
