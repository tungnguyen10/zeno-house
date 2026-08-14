import { ContractAmendmentService } from '../../../../../services/contract-amendments'
import { contractAmendmentCancelSchema } from '~/utils/validators/contract-amendments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const amendmentId = getRouterParam(event, 'amendmentId')!
  const input = await parseBody(event, contractAmendmentCancelSchema)
  return { data: await ContractAmendmentService.cancel(event, user, contractId, amendmentId, input) }
})
