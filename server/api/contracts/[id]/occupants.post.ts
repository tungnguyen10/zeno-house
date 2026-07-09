import { ContractOccupantService } from '../../../services/contract-occupants'
import { contractOccupantAddSchema } from '~/utils/validators/contract-occupants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const input = await parseBody(event, contractOccupantAddSchema)

  const occupant = await ContractOccupantService.add(event, user, contractId, input)

  setResponseStatus(event, 201)
  return { data: occupant }
})
