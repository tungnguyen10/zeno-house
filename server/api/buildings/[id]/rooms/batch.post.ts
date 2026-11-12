import { roomBatchCreateSchema } from '~/utils/validators/inventory'
import { RoomService } from '../../../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, roomBatchCreateSchema, 'Danh sách phòng không hợp lệ')
  const { rooms, replayed } = await RoomService.createBatch(event, user, id, input)
  setResponseStatus(event, replayed ? 200 : 201)
  return { data: rooms, meta: { room_count: rooms.length, replayed } }
})
