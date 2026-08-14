import { ContractAmendmentService } from '../../../../services/contract-amendments'
import { contractAmendmentUpdateSchema } from '~/utils/validators/contract-amendments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const amendmentId = getRouterParam(event, 'amendmentId')!
  const input = await parseBody(event, contractAmendmentUpdateSchema)
  return { data: await ContractAmendmentService.update(event, user, contractId, amendmentId, input) }
})
