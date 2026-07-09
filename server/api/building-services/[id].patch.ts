import { BuildingServiceService } from '../../services/building-services'
import { buildingServiceUpdateSchema } from '~/utils/validators/building-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id') as string
  const input = await parseBody(event, buildingServiceUpdateSchema)

  const service = await BuildingServiceService.update(event, user, id, input)
  return { data: service }
})
