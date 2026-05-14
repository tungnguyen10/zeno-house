import { RoomService } from '../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  await RoomService.remove(event, user, id)
  setResponseStatus(event, 204)
})
