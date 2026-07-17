import { TenantAccountService } from '../../../../services/tenant-portal/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  await TenantAccountService.revoke(event, user, id)
  setResponseStatus(event, 204)
})
