import { ContractServiceService } from '../../services/contract-services'
import { contractServiceDeleteSchema } from '~/utils/validators/contract-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const result = contractServiceDeleteSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  await ContractServiceService.remove(event, user, id, { reason: result.data.reason })
  setResponseStatus(event, 204)
})
