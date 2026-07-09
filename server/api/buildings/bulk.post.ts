import { BuildingService } from '../../services/buildings'
import { buildingBulkActionSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, buildingBulkActionSchema)

  const data = await BuildingService.bulkAction(event, user, input)
  return { data }
})
