import { ContractOccupantService } from '../../../../services/contract-occupants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const occupantId = getRouterParam(event, 'occupantId')!

  await ContractOccupantService.remove(event, user, contractId, occupantId)

  setResponseStatus(event, 204)
  return null
})
