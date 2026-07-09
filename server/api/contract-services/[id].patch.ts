import { ContractServiceService } from '../../services/contract-services'
import { contractServiceUpdateSchema } from '~/utils/validators/contract-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id') as string
  const input = await parseBody(event, contractServiceUpdateSchema)

  const service = await ContractServiceService.update(event, user, id, input)
  return { data: service }
})
