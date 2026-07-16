import { readMultipartFormData } from 'h3'
import { TenantDocumentService } from '../../../services/tenant-portal/documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'document' && part.data.length > 0)
  if (!file) throwValidationError('Thiếu tệp tài liệu')

  const document = await TenantDocumentService.upload(event, user, {
    name: file.filename ?? 'document',
    mimeType: file.type ?? '',
    data: file.data,
  })
  return { data: document }
})
