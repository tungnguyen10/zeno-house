import { RoomService } from '../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const room = await RoomService.get(event, user, id)
  return { data: room }
})
