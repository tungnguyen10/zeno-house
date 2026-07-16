import { TenantContractService } from '../../services/tenant-portal/contract'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  return { data: await TenantContractService.get(event, user) }
})
