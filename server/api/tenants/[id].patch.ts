import { TenantService } from '../../services/tenants'
import { tenantUpdateSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, tenantUpdateSchema)

  const tenant = await TenantService.update(event, user, id, input)
  return { data: tenant }
})
