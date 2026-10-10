import { tenantExportCandidatesQuerySchema } from '~/utils/validators/tenants'
import { TenantExportService } from '../../services/tenants/export'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { building_id } = parseQuery(event, tenantExportCandidatesQuerySchema)
  setHeader(event, 'Cache-Control', 'no-store')
  return { data: await TenantExportService.listCandidates(event, user, building_id) }
})
