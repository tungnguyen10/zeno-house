import { TenantContractDocumentService } from '../../../services/tenant-portal/contract-documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await TenantContractDocumentService.list(event, user) }
})
