import { ContractServiceService } from '../../services/contract-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  if (!query.building_id) {
    throw createError({ statusCode: 400, message: 'building_id là bắt buộc' })
  }

  const services = await ContractServiceService.listByBuilding(event, user, String(query.building_id))
  return { data: services }
})
