import { MeterReadingService } from '../../services/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  if (!query.building_id) {
    throw createError({ statusCode: 400, message: 'building_id là bắt buộc' })
  }

  const buildingId = String(query.building_id)
  const now = new Date()
  const periodYear = query.period_year ? Number(query.period_year) : now.getFullYear()
  const periodMonth = query.period_month ? Number(query.period_month) : now.getMonth() + 1

  const status = await MeterReadingService.getBuildingStatus(event, user, buildingId, periodYear, periodMonth)
  return { data: status }
})
