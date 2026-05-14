import { RoomService } from '../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)

  const page = query.page ? Number(query.page) : 1
  const limit = query.limit ? Number(query.limit) : 20

  const filters = {
    buildingId: query.building_id ? String(query.building_id) : undefined,
    status: query.status ? String(query.status) : undefined,
    floor: query.floor !== undefined ? Number(query.floor) : undefined,
    page,
    limit,
  }

  const { items, total } = await RoomService.list(event, user, filters)

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
