import { MeterReadingService } from '../../services/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const filters = {
    room_id: query.room_id ? String(query.room_id) : undefined,
    building_id: query.building_id ? String(query.building_id) : undefined,
    period_year: query.period_year ? Number(query.period_year) : undefined,
    period_month: query.period_month ? Number(query.period_month) : undefined,
    meter_type: query.meter_type ? String(query.meter_type) : undefined,
  }

  const items = await MeterReadingService.list(event, user, filters)
  return { data: items }
})
