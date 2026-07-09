import { ContractPaymentService } from '../../../services/contract-payments'
import { contractPaymentCreateSchema } from '~/utils/validators/contract-payments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const input = await parseBody(event, contractPaymentCreateSchema)

  const payment = await ContractPaymentService.create(event, user, contractId, input)

  setResponseStatus(event, 201)
  return { data: payment }
})
