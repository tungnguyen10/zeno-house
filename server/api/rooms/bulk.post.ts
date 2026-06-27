import { RoomService } from '../../services/rooms'
import { roomBulkActionSchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = roomBulkActionSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await RoomService.bulkAction(event, user, result.data)
  return { data }
})
