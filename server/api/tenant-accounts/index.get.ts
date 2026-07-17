import { TenantAccountService } from '../../services/tenant-portal/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await TenantAccountService.list(event, user) }
})
