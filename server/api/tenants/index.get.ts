import { TenantService } from '../../services/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const page = query.page ? Number(query.page) : 1
  const limit = query.limit ? Number(query.limit) : 20

  const filters = {
    q: query.q ? String(query.q) : undefined,
    page,
    limit,
    unassigned: query.unassigned === 'true',
    available: query.available === 'true',
    excludeContractId: query.excludeContractId ? String(query.excludeContractId) : undefined,
  }

  const { items, total } = await TenantService.list(event, user, filters)

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
