import { BuildingService } from '../../../services/buildings'
import { buildingVisibilitySchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const input = await parseBody(event, buildingVisibilitySchema)

  const building = await BuildingService.setVisibility(event, user, id, input)
  return { data: building }
})
