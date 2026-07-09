import { RoomService } from '../../services/rooms'
import { roomDeleteSchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, roomDeleteSchema)

  const query = getQuery(event)
  const force = query.force === 'true' || query.force === true || query.force === '1'

  if (force) {
    const room = await RoomService.remove(event, user, id, { force: true, reason: input.reason })
    return { data: room }
  }

  await RoomService.remove(event, user, id, { reason: input.reason })
  setResponseStatus(event, 204)
})
