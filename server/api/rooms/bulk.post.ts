import { RoomService } from '../../services/rooms'
import { roomBulkActionSchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, roomBulkActionSchema)

  const data = await RoomService.bulkAction(event, user, input)
  return { data }
})
