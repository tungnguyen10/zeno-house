import { ContractService } from '../../services/contracts'
import { contractUpdateSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, contractUpdateSchema)

  const contract = await ContractService.update(event, user, id, input)
  return { data: contract }
})
