import { ContractRenewalService } from '../../../services/contract-renewals'
import { contractRenewSchema } from '~/utils/validators/contract-renewals'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const input = await parseBody(event, contractRenewSchema)

  const renewal = await ContractRenewalService.renew(event, user, contractId, input)

  setResponseStatus(event, 201)
  return { data: renewal }
})
