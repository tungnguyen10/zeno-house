import { ContractService } from '../../../services/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await ContractService.getHandoverInventory(event, user, getRouterParam(event, 'id')!) }
})
