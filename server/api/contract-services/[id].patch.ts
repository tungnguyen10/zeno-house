import { ContractServiceService } from '../../services/contract-services'
import { contractServiceUpdateSchema } from '~/utils/validators/contract-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const result = contractServiceUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const service = await ContractServiceService.update(event, user, id, result.data)
  return { data: service }
})
