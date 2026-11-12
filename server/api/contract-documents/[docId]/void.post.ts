import { contractDocumentVoidSchema } from '~/utils/validators/contract-documents'
import { ContractDocumentService } from '../../../services/contract-documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, contractDocumentVoidSchema)
  return { data: await ContractDocumentService.void(event, user, getRouterParam(event, 'docId')!, input.reason) }
})
