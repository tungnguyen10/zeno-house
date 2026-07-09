import { BuildingService } from '../../services/buildings'
import { buildingUpdateSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, buildingUpdateSchema)

  const building = await BuildingService.update(event, user, id, input)
  return { data: building }
})
