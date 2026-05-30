import { BuildingServiceService } from '../../services/building-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  if (!query.building_id) {
    throw createError({ statusCode: 400, message: 'building_id là bắt buộc' })
  }

  const services = await BuildingServiceService.list(event, user, String(query.building_id))
  return { data: services }
})
