import { contractDocumentPreviewSchema } from '~/utils/validators/contract-documents'
import { ContractDocumentService } from '../../../../services/contract-documents'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, contractDocumentPreviewSchema)
  const buffer = await ContractDocumentService.preview(event, user, getRouterParam(event, 'id')!, input)
  setHeader(event, 'Content-Type', DOCX_MIME)
  setHeader(event, 'Content-Disposition', 'attachment; filename="hop-dong-xem-truoc.docx"')
  return buffer
})
