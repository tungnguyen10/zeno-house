import { ContractPaymentService } from '../../../../services/contract-payments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  const paymentId = getRouterParam(event, 'paymentId')!

  await ContractPaymentService.remove(event, user, contractId, paymentId)
  setResponseStatus(event, 204)
})
