import { TenantDocumentService } from '../../../services/tenant-portal/documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  return { data: await TenantDocumentService.list(event, user) }
})
