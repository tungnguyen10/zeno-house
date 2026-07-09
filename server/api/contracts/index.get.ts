import { ContractService } from '../../services/contracts'
import { contractListQuerySchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { page, limit, q, building_id, room_id, tenant_id, status, sort, order } = parseQuery(event, contractListQuerySchema)

  const { items, total } = await ContractService.list(event, user, {
    page,
    limit,
    q,
    building_id,
    room_id,
    tenant_id,
    status,
    sort,
    order,
  })

  return paginated(items, { total, page, limit })
})
