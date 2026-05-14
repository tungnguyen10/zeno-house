import { TenantService } from '../../services/tenants'
import { tenantCreateSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = tenantCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const tenant = await TenantService.create(event, user, result.data)

  setResponseStatus(event, 201)
  return { data: tenant }
})
