import { RoomService } from '../../services/rooms'
import { roomListQuerySchema } from '~/utils/validators/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { page, limit, q, building_id: buildingId, floor, status, sort, order } = parseQuery(event, roomListQuerySchema)
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

  return paginated(items, { total, page, limit })
})
