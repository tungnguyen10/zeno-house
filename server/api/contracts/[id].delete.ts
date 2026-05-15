import { ContractService } from '../../services/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  await ContractService.remove(event, user, id)
  setResponseStatus(event, 204)
})
