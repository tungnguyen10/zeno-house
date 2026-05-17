import { ContractOccupantService } from '../../../../services/contract-occupants'
import { contractOccupantMoveOutSchema } from '~/utils/validators/contract-occupants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const occupantId = getRouterParam(event, 'occupantId')!

  const body = await readBody(event)
  const result = contractOccupantMoveOutSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const occupant = await ContractOccupantService.moveOut(event, user, contractId, occupantId, result.data)
  return { data: occupant }
})
