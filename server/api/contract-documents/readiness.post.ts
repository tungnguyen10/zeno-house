import { contractDocumentReadinessSchema } from '~/utils/validators/contract-documents'
import { ContractDocumentService } from '../../services/contract-documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, contractDocumentReadinessSchema)
  return { data: await ContractDocumentService.readiness(event, user, input) }
})
