import { ContractAmendmentService } from '../../../services/contract-amendments'
import { contractAmendmentCreateSchema } from '~/utils/validators/contract-amendments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const input = await parseBody(event, contractAmendmentCreateSchema)
  const amendment = await ContractAmendmentService.create(event, user, contractId, input)
  setResponseStatus(event, 201)
  return { data: amendment }
})
