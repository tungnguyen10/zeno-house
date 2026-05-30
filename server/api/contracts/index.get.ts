import { ContractService } from '../../services/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const page = query.page ? Number(query.page) : 1
  const limit = query.limit ? Number(query.limit) : 20

  const filters = {
    room_id: query.room_id ? String(query.room_id) : undefined,
    tenant_id: query.tenant_id ? String(query.tenant_id) : undefined,
    building_id: query.building_id ? String(query.building_id) : undefined,
    status: query.status ? String(query.status) : undefined,
    page,
    limit,
  }

  const { items, total } = await ContractService.list(event, user, filters)

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
