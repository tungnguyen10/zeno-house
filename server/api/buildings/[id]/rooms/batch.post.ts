import { roomBatchCreateSchema } from '~/utils/validators/inventory'
import { RoomService } from '../../../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = roomBatchCreateSchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Danh sách phòng không hợp lệ', result.error.flatten())
  const { rooms, replayed } = await RoomService.createBatch(event, user, id, result.data)
  setResponseStatus(event, replayed ? 200 : 201)
  return { data: rooms, meta: { room_count: rooms.length, replayed } }
})
