import { ContractCreateDraftService } from '../../services/contracts/create-draft'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await ContractCreateDraftService.get(event, user) }
})
