import type { Tenant, TenantStatus } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'
import { useRouteListQuerySync } from '~/composables/useRouteListQuerySync'

export const TENANT_LIST_ASYNC_KEY = 'tenants:list'

export function invalidateTenantListCache() {
  clearNuxtData(TENANT_LIST_ASYNC_KEY)
}

type SortField = 'full_name' | 'created_at' | 'code'
type SortOrder = 'asc' | 'desc'
type ContractState = 'with_contract' | 'without_contract'

const SORT_FIELDS: SortField[] = ['full_name', 'created_at', 'code']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const STATUSES: TenantStatus[] = ['active', 'archived']
const CONTRACT_STATES: ContractState[] = ['with_contract', 'without_contract']

function readStatuses(raw: unknown): TenantStatus[] {
  const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  return arr
    .map(v => String(v))
    .filter((v): v is TenantStatus => (STATUSES as string[]).includes(v))
}

function readSortField(raw: unknown): SortField {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_FIELDS as string[]).includes(v) ? (v as SortField) : 'full_name'
}

function readSortOrder(raw: unknown): SortOrder {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_ORDERS as string[]).includes(v) ? (v as SortOrder) : 'asc'
}

function readContractState(raw: unknown): ContractState | '' {
  const v = typeof raw === 'string' ? raw : ''
  return (CONTRACT_STATES as string[]).includes(v) ? (v as ContractState) : ''
}

export function useTenantList() {
  const route = useRoute()

  const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
  const limit = ref(Math.min(100, Math.max(1, Number(route.query.limit ?? 20) || 20)))
  const q = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')
  const buildingFilter = ref<string>(typeof route.query.building_id === 'string' ? route.query.building_id : '')
  const contractStateFilter = ref<ContractState | ''>(readContractState(route.query.contract_state))
  const status = ref<TenantStatus[]>(readStatuses(route.query.status))
  const sort = ref<SortField>(readSortField(route.query.sort))
  const order = ref<SortOrder>(readSortOrder(route.query.order))

  useRouteListQuerySync({
    page,
    resetPageOn: [q, buildingFilter, contractStateFilter, status, sort, order],
    syncOn: [page],
    parseRoute(newQuery) {
      const newPage = Math.max(1, Number(newQuery.page ?? 1) || 1)
      const newLimit = Math.min(100, Math.max(1, Number(newQuery.limit ?? 20) || 20))
      const newQ = typeof newQuery.q === 'string' ? newQuery.q : ''
      const newBuilding = typeof newQuery.building_id === 'string' ? newQuery.building_id : ''
      const newContractState = readContractState(newQuery.contract_state)
      const newStatus = readStatuses(newQuery.status)
      const newSort = readSortField(newQuery.sort)
      const newOrder = readSortOrder(newQuery.order)

      if (page.value !== newPage) page.value = newPage
      if (limit.value !== newLimit) limit.value = newLimit
      if (q.value !== newQ) q.value = newQ
      if (buildingFilter.value !== newBuilding) buildingFilter.value = newBuilding
      if (contractStateFilter.value !== newContractState) contractStateFilter.value = newContractState
      if (JSON.stringify(status.value) !== JSON.stringify(newStatus)) status.value = newStatus
      if (sort.value !== newSort) sort.value = newSort
      if (order.value !== newOrder) order.value = newOrder
    },
    buildQuery(query) {
      const next: Record<string, string | string[] | undefined> = {}

      for (const [k, v] of Object.entries(query)) {
        if (v === null || v === undefined) continue
        if (Array.isArray(v)) {
          const filtered = v.filter((item): item is string => typeof item === 'string')
          if (filtered.length > 0) next[k] = filtered
        }
        else if (typeof v === 'string') {
          next[k] = v
        }
      }

      next.page = page.value > 1 ? String(page.value) : undefined
      next.q = q.value || undefined
      next.building_id = buildingFilter.value || undefined
      next.contract_state = contractStateFilter.value || undefined
      next.status = status.value.length > 0 ? status.value : undefined
      next.sort = sort.value !== 'full_name' ? sort.value : undefined
      next.order = order.value !== 'asc' ? order.value : undefined

      return next
    },
  })

  const queryParams = computed(() => ({
    page: page.value,
    limit: limit.value,
    q: q.value || undefined,
    building_id: buildingFilter.value || undefined,
    contract_state: contractStateFilter.value || undefined,
    status: status.value.length > 0 ? status.value : undefined,
    sort: sort.value,
    order: order.value,
  }))

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<Tenant[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/tenants', {
    key: TENANT_LIST_ASYNC_KEY,
    query: queryParams,
    watch: [page, limit, q, buildingFilter, contractStateFilter, status, sort, order],
  })

  const tenants = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => fetchStatus.value === 'pending')
  const hasActiveFilters = computed(() =>
    Boolean(q.value)
    || Boolean(buildingFilter.value)
    || Boolean(contractStateFilter.value)
    || status.value.length > 0
    || sort.value !== 'full_name'
    || order.value !== 'asc',
  )

  function resetFilters() {
    q.value = ''
    buildingFilter.value = ''
    contractStateFilter.value = ''
    status.value = []
    sort.value = 'full_name'
    order.value = 'asc'
    page.value = 1
  }

  return {
    tenants,
    total,
    totalPages,
    page,
    limit,
    q,
    buildingFilter,
    contractStateFilter,
    status,
    sort,
    order,
    hasActiveFilters,
    resetFilters,
    isLoading,
    error,
    refresh,
  }
}
