import { TenantAccountService } from '../../../../services/tenant-portal/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await TenantAccountService.getStatus(event, user, id) }
})
