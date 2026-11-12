import { contractDocumentIssueSchema } from '~/utils/validators/contract-documents'
import { ContractDocumentService } from '../../../../services/contract-documents'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, contractDocumentIssueSchema)
  setResponseStatus(event, 201)
  return { data: await ContractDocumentService.issue(event, user, getRouterParam(event, 'id')!, input) }
})
