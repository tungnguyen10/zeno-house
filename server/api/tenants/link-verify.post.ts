import { TenantLinkService } from '../../services/tenants/link'
import { tenantLinkVerifySchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, tenantLinkVerifySchema)
  return { data: await TenantLinkService.verify(event, user, input) }
})
