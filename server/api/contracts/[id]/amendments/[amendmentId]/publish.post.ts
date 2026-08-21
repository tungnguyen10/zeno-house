import { ContractAmendmentService } from '../../../../../services/contract-amendments'
import { contractAmendmentPublishSchema } from '~/utils/validators/contract-amendments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const amendmentId = getRouterParam(event, 'amendmentId')!
  const input = await parseBody(event, contractAmendmentPublishSchema)
  return { data: await ContractAmendmentService.publish(event, user, contractId, amendmentId, input) }
})
