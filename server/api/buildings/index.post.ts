import { BuildingService } from '../../services/buildings'
import { buildingCreateWithRoomsSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, buildingCreateWithRoomsSchema)

  const { building, roomCount } = await BuildingService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: building, meta: { room_count: roomCount } }
})
