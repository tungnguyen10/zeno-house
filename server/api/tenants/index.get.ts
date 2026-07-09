import { TenantService } from '../../services/tenants'
import { tenantListQuerySchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { page, limit, q, building_id, contract_state, status, sort, order, available, excludeContractId } = parseQuery(event, tenantListQuerySchema)
  const { items, total } = await TenantService.list(event, user, {
    page,
    limit,
    q,
    building_id,
    contract_state,
    status,
    sort,
    order,
    available,
    excludeContractId,
  })

  return paginated(items, { total, page, limit })
})
