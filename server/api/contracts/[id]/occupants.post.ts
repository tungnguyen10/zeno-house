import { ContractOccupantService } from '../../../services/contract-occupants'
import { contractOccupantAddSchema } from '~/utils/validators/contract-occupants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = contractOccupantAddSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const occupant = await ContractOccupantService.add(event, user, contractId, result.data)

  setResponseStatus(event, 201)
  return { data: occupant }
})
