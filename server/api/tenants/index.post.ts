import { TenantService } from '../../services/tenants'
import { tenantCreateSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, tenantCreateSchema)

  const tenant = await TenantService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: tenant }
})
