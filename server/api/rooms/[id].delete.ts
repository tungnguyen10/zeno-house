import { RoomService } from '../../services/rooms'
import { roomDeleteSchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const result = roomDeleteSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const query = getQuery(event)
  const force = query.force === 'true' || query.force === true || query.force === '1'

  if (force) {
    const room = await RoomService.remove(event, user, id, { force: true, reason: result.data.reason })
    return { data: room }
  }

  await RoomService.remove(event, user, id, { reason: result.data.reason })
  setResponseStatus(event, 204)
})
