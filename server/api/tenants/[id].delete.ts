import { TenantService } from '../../services/tenants'
import { tenantDeleteSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const result = tenantDeleteSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const query = getQuery(event)
  const force = query.force === 'true' || query.force === true || query.force === '1'

  if (force) {
    const tenant = await TenantService.remove(event, user, id, {
      force: true,
      reason: result.data.reason,
      buildingId: result.data.building_id,
    })
    return { data: tenant }
  }

  await TenantService.remove(event, user, id, {
    reason: result.data.reason,
    buildingId: result.data.building_id,
  })
  setResponseStatus(event, 204)
})
