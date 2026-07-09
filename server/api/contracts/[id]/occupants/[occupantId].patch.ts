import { ContractOccupantService } from '../../../../services/contract-occupants'
import { contractOccupantMoveOutSchema } from '~/utils/validators/contract-occupants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const occupantId = getRouterParam(event, 'occupantId')!

  const input = await parseBody(event, contractOccupantMoveOutSchema)

  const occupant = await ContractOccupantService.moveOut(event, user, contractId, occupantId, input)
  return { data: occupant }
})
