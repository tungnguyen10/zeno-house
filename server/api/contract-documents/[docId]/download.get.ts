import { ContractDocumentService } from '../../../services/contract-documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await ContractDocumentService.download(event, user, getRouterParam(event, 'docId')!) }
})
