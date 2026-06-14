import { TenantService } from '../../services/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const page = query.page ? Number(query.page) : 1
  const limit = query.limit ? Number(query.limit) : 20
  const contractState: 'with_contract' | 'without_contract' | undefined = query.contract_state === 'with_contract' || query.contract_state === 'without_contract'
    ? query.contract_state
    : undefined

  const filters = {
    q: query.q ? String(query.q) : undefined,
    building_id: query.building_id ? String(query.building_id) : undefined,
    contract_state: contractState,
    page,
    limit,
    available: query.available === 'true',
    excludeContractId: query.excludeContractId ? String(query.excludeContractId) : undefined,
  }

  const { items, total } = await TenantService.list(event, user, filters)

  return {
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
})
