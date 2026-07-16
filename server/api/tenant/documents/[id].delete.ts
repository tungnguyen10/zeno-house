import { TenantDocumentService } from '../../../services/tenant-portal/documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Mã tài liệu không hợp lệ')

  await TenantDocumentService.remove(event, user, id)
  setResponseStatus(event, 204)
})
