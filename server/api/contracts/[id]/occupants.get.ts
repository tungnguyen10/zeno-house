import { ContractOccupantService } from '../../../services/contract-occupants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const occupants = await ContractOccupantService.list(event, user, contractId)
  return { data: occupants }
})
