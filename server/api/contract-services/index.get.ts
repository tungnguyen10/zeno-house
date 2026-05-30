import { ContractServiceService } from '../../services/contract-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  if (!query.contract_id) {
    throw createError({ statusCode: 400, message: 'contract_id là bắt buộc' })
  }

  const services = await ContractServiceService.list(event, user, String(query.contract_id))
  return { data: services }
})
