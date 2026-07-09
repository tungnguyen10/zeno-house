import { RoomService } from '../../services/rooms'
import { roomCreateSchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, roomCreateSchema)

  const room = await RoomService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: room }
})
