import { TenantService } from '../../services/tenants'
import { tenantBulkActionSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = tenantBulkActionSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await TenantService.bulkAction(event, user, result.data)
  return { data }
})
