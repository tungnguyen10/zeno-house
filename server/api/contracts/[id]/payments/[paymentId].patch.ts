import { ContractPaymentService } from '../../../../services/contract-payments'
import { contractPaymentUpdateSchema } from '~/utils/validators/contract-payments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const paymentId = getRouterParam(event, 'paymentId')!

  const input = await parseBody(event, contractPaymentUpdateSchema)

  const payment = await ContractPaymentService.update(event, user, contractId, paymentId, input)
  return { data: payment }
})
