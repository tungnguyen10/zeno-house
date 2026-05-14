import { TenantService } from '../../services/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const tenant = await TenantService.get(event, user, id)
  return { data: tenant }
})
