import { ContractPaymentService } from '../../../services/contract-payments'
import { contractPaymentCreateSchema } from '~/utils/validators/contract-payments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = contractPaymentCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const payment = await ContractPaymentService.create(event, user, contractId, result.data)

  setResponseStatus(event, 201)
  return { data: payment }
})
