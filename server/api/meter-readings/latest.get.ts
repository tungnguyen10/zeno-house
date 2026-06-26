import { MeterReadingService } from '../../services/meter-readings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const roomId = query.room_id ? String(query.room_id) : ''
  if (!roomId) {
    throwValidationError('room_id là bắt buộc')
  }

  const beforeDate = query.before_date ? String(query.before_date) : undefined

  const data = await MeterReadingService.getLatestByRoom(event, user, roomId, { beforeDate })
  return { data }
})
