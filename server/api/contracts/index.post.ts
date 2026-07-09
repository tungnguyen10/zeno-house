import { ContractService } from '../../services/contracts'
import { contractCreateSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, contractCreateSchema)

  const contract = await ContractService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: contract }
})
