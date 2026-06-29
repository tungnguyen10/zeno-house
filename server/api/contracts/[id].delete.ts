import { ContractService } from '../../services/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const query = getQuery(event)
  const force = query.force === 'true'

  const deleted = await ContractService.remove(event, user, id, { force })
  if (force) return { data: deleted }

  setResponseStatus(event, 204)
})
