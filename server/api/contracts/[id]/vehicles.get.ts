import { ContractService } from '../../../services/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await ContractService.getVehicles(event, user, getRouterParam(event, 'id')!) }
})
