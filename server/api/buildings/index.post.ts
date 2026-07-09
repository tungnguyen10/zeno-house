import { BuildingService } from '../../services/buildings'
import { buildingCreateSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, buildingCreateSchema)

  const building = await BuildingService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: building }
})
