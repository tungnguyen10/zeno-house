import { ContractServiceService } from '../../services/contract-services'
import { contractServiceDeleteSchema } from '~/utils/validators/contract-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') as string
  const input = await parseBody(event, contractServiceDeleteSchema)

  await ContractServiceService.remove(event, user, id, { reason: input.reason })
  setResponseStatus(event, 204)
})
