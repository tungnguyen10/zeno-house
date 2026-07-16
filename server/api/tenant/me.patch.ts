import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'
import { TenantProfileService } from '../../services/tenant-portal/profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const input = await parseBody(event, tenantProfileUpdateSchema, 'Hồ sơ cập nhật không hợp lệ')
  return { data: await TenantProfileService.update(event, user, input) }
})
