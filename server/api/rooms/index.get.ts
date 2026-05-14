import { RoomService } from '../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)

  const filters = {
    buildingId: query.building_id ? String(query.building_id) : undefined,
    status: query.status ? String(query.status) : undefined,
    floor: query.floor !== undefined ? Number(query.floor) : undefined,
  }

  const { items, total } = await RoomService.list(event, user, filters)

  return {
    data: items,
    meta: { total },
  }
})
