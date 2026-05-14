import { RoomService } from '../../services/rooms'
import { roomCreateSchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = roomCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const room = await RoomService.create(event, user, result.data)

  setResponseStatus(event, 201)
  return { data: room }
})
