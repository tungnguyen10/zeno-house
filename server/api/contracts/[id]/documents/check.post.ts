import { contractDocumentCheckSchema } from '~/utils/validators/contract-documents'
import { ContractDocumentService } from '../../../../services/contract-documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, contractDocumentCheckSchema)
  return { data: await ContractDocumentService.check(event, user, getRouterParam(event, 'id')!, input) }
})
