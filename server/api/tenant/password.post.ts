import { tenantPasswordChangeSchema } from '~/utils/validators/tenant-portal'
import { TenantPasswordService } from '../../services/tenant-portal/password'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(
    event,
    tenantPasswordChangeSchema,
    'Thông tin đổi mật khẩu không hợp lệ',
  )
  await TenantPasswordService.change(event, user, input)
  return { data: null }
})
