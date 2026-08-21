import { ContractAmendmentService } from '../../../../services/contract-amendments'
import { contractAmendmentDeleteSchema } from '~/utils/validators/contract-amendments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const amendmentId = getRouterParam(event, 'amendmentId')!
  const input = await parseBody(event, contractAmendmentDeleteSchema)
  await ContractAmendmentService.removeDraft(
    event, user, contractId, amendmentId, input.expected_updated_at,
  )
  setResponseStatus(event, 204)
})
