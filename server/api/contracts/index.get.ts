import { ContractService } from '../../services/contracts'
import { contractListQuerySchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rawQuery = getQuery(event)
  const result = contractListQuerySchema.safeParse(rawQuery)
  if (!result.success) {
    throwValidationError('Tham số truy vấn không hợp lệ', result.error.flatten())
  }

  const { page, limit, q, building_id, room_id, tenant_id, status, sort, order } = result.data

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

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
