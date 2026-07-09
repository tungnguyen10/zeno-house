import { TenantService } from '../../services/tenants'
import { tenantBulkCreateSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, tenantBulkCreateSchema)

  const data = await TenantService.bulkCreate(event, user, input)
  return { data, meta: { created: data.created.length, failed: data.failed.length } }
})