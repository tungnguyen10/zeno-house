import { RoomService } from '../../services/rooms'
import { roomListQuerySchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rawQuery = getQuery(event)
  const result = roomListQuerySchema.safeParse(rawQuery)
  if (!result.success) {
    throwValidationError('Tham số truy vấn không hợp lệ', result.error.flatten())
  }

  const { page, limit, q, building_id: buildingId, floor, status, sort, order } = result.data
  const { items, total } = await RoomService.list(event, user, {
    buildingId,
    status,
    floor,
    page,
    limit,
    q,
    sort,
    order,
  })

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
