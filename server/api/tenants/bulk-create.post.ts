import { TenantService } from '../../services/tenants'
import { tenantBulkCreateSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = tenantBulkCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await TenantService.bulkCreate(event, user, result.data)
  return { data, meta: { created: data.created.length, failed: data.failed.length } }
})