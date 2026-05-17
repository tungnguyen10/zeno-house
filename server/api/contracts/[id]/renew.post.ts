import { ContractRenewalService } from '../../../services/contract-renewals'
import { contractRenewSchema } from '~/utils/validators/contract-renewals'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = contractRenewSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const renewal = await ContractRenewalService.renew(event, user, contractId, result.data)

  setResponseStatus(event, 201)
  return { data: renewal }
})
