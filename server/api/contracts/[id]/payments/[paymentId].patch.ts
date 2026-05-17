import { ContractPaymentService } from '../../../../services/contract-payments'
import { contractPaymentUpdateSchema } from '~/utils/validators/contract-payments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const paymentId = getRouterParam(event, 'paymentId')!

  const body = await readBody(event)
  const result = contractPaymentUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const payment = await ContractPaymentService.update(event, user, contractId, paymentId, result.data)
  return { data: payment }
})
