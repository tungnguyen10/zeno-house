import { TenantService } from '../../services/tenants'
import { tenantListQuerySchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rawQuery = getQuery(event)
  const result = tenantListQuerySchema.safeParse(rawQuery)
  if (!result.success) {
    throwValidationError('Tham số truy vấn không hợp lệ', result.error.flatten())
  }

  const { page, limit, q, building_id, contract_state, status, sort, order, available, excludeContractId } = result.data
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

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
