import { RoomService } from '../../../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const buildingIdentifier = getRouterParam(event, 'id')!
  const roomSlug = getRouterParam(event, 'room')!

  const room = await RoomService.getByBuildingAndRoomSlug(event, user, buildingIdentifier, roomSlug)
  return { data: room }
})
