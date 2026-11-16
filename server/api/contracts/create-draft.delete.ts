import { ContractCreateDraftService } from '../../services/contracts/create-draft'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await ContractCreateDraftService.remove(event, user)
  return { data: null }
})
