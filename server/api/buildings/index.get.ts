import { BuildingService } from '../../services/buildings'
import { buildingListQuerySchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { page, limit, q, status, sort, order } = parseQuery(event, buildingListQuerySchema)
  const { items, total } = await BuildingService.list(event, user, { page, limit, q, status, sort, order })

  return paginated(items, { total, page, limit })
})
