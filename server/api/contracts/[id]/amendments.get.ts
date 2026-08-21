import { ContractAmendmentService } from '../../../services/contract-amendments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const contractId = getRouterParam(event, 'id')!
  return { data: await ContractAmendmentService.list(event, user, contractId) }
})
