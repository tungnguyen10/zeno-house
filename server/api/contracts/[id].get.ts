import { ContractService } from '../../services/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const contract = await ContractService.get(event, user, id)
  return { data: contract }
})
