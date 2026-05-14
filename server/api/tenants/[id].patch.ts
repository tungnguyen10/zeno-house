import { TenantService } from '../../services/tenants'
import { tenantUpdateSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = tenantUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const tenant = await TenantService.update(event, user, id, result.data)
  return { data: tenant }
})
