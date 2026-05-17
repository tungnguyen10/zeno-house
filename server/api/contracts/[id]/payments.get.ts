import { ContractPaymentService } from '../../../services/contract-payments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const payments = await ContractPaymentService.list(event, user, contractId)
  return { data: payments }
})
