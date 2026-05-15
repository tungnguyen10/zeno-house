import { ContractService } from '../../services/contracts'
import { contractUpdateSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = contractUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const contract = await ContractService.update(event, user, id, result.data)
  return { data: contract }
})
