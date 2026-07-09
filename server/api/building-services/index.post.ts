import { BuildingServiceService } from '../../services/building-services'
import { buildingServiceUpsertSchema } from '~/utils/validators/building-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, buildingServiceUpsertSchema)

  const service = await BuildingServiceService.upsert(event, user, input)
  return { data: service }
})
