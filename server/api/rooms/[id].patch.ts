import { RoomService } from '../../services/rooms'
import { roomUpdateSchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, roomUpdateSchema)

  const room = await RoomService.update(event, user, id, input)
  return { data: room }
})
