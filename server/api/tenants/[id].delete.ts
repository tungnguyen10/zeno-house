import { TenantService } from '../../services/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  await TenantService.remove(event, user, id)
  setResponseStatus(event, 204)
})
