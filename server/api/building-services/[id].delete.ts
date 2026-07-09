import { BuildingServiceService } from '../../services/building-services'
import { buildingServiceDeleteSchema } from '~/utils/validators/building-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') as string
  const input = await parseBody(event, buildingServiceDeleteSchema)

  await BuildingServiceService.remove(event, user, id, { reason: input.reason })
  setResponseStatus(event, 204)
})
