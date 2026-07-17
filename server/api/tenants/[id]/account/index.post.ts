import { tenantAccountProvisionSchema } from '~/utils/validators/tenant-accounts'
import { TenantAccountService } from '../../../../services/tenant-portal/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, tenantAccountProvisionSchema, 'Thông tin tài khoản không hợp lệ')
  setResponseStatus(event, 201)
  return { data: await TenantAccountService.provision(event, user, id, input) }
})
