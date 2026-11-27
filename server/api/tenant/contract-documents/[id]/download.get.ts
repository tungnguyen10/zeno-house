import { tenantContractDocumentIdSchema } from '~/utils/validators/tenant-contract-documents'
import { TenantContractDocumentService } from '../../../../services/tenant-portal/contract-documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = tenantContractDocumentIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) throwNotFound('Không tìm thấy tài liệu')
  return { data: await TenantContractDocumentService.download(event, user, parsed.data) }
})
