import { tenantAccountStatusUpdateSchema } from '~/utils/validators/tenant-accounts'
import { TenantAccountService } from '../../../../services/tenant-portal/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, tenantAccountStatusUpdateSchema, 'Trạng thái tài khoản không hợp lệ')
  return { data: await TenantAccountService.setStatus(event, user, id, input) }
})
