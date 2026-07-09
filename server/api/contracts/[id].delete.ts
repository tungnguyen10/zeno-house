import { ContractService } from '../../services/contracts'
import { contractDeleteSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, contractDeleteSchema)

  const query = getQuery(event)
  const force = query.force === 'true'

  const deleted = await ContractService.remove(event, user, id, {
    force,
    reason: input.reason,
  })
  if (force) return { data: deleted }

  setResponseStatus(event, 204)
})
