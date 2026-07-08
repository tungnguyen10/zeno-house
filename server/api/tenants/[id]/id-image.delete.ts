import { TenantService } from '../../../services/tenants'
import { tenantIdImageSideSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const query = getQuery(event)
  const sideResult = tenantIdImageSideSchema.safeParse(query.side)
  if (!sideResult.success) {
    throwValidationError('Mặt CCCD không hợp lệ', sideResult.error.flatten())
  }

  const tenant = await TenantService.removeIdImage(event, user, id, sideResult.data)
  return { data: tenant }
})
