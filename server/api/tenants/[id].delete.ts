import { TenantService } from '../../services/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const query = getQuery(event)
  const force = query.force === 'true' || query.force === true || query.force === '1'

  if (force) {
    const tenant = await TenantService.remove(event, user, id, { force: true })
    return { data: tenant }
  }

  await TenantService.remove(event, user, id)
  setResponseStatus(event, 204)
})
