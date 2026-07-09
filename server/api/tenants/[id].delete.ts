import { TenantService } from '../../services/tenants'
import { tenantDeleteSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, tenantDeleteSchema)

  const query = getQuery(event)
  const force = query.force === 'true' || query.force === true || query.force === '1'

  if (force) {
    const tenant = await TenantService.remove(event, user, id, {
      force: true,
      reason: input.reason,
      buildingId: input.building_id,
    })
    return { data: tenant }
  }

  await TenantService.remove(event, user, id, {
    reason: input.reason,
    buildingId: input.building_id,
  })
  setResponseStatus(event, 204)
})
