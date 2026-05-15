import { ContractService } from '../../services/contracts'
import { contractCreateSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = contractCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const contract = await ContractService.create(event, user, result.data)

  setResponseStatus(event, 201)
  return { data: contract }
})
