import { ContractRenewalService } from '../../../services/contract-renewals'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const renewals = await ContractRenewalService.list(event, user, contractId)
  return { data: renewals }
})
