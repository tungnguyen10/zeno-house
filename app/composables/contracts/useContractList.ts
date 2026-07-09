import type { ContractStatus, ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'
import {
  copyStringQuery,
  readQueryEnum,
  readQueryEnumArray,
  readQueryNumber,
  readQueryString,
  useRouteListQuerySync,
} from '~/composables/useRouteListQuerySync'

export const CONTRACT_LIST_ASYNC_KEY = 'contracts:list'

export function invalidateContractListCache() {
  clearNuxtData(CONTRACT_LIST_ASYNC_KEY)
}

type SortField = 'start_date' | 'end_date' | 'created_at' | 'monthly_rent'
type SortOrder = 'asc' | 'desc'

const SORT_FIELDS: SortField[] = ['start_date', 'end_date', 'created_at', 'monthly_rent']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const STATUSES: ContractStatus[] = ['active', 'expired', 'terminated', 'renewed']

export function useContractList() {
  const route = useRoute()

  const page = ref(readQueryNumber(route.query.page, { fallback: 1, min: 1 }))
  const limit = ref(readQueryNumber(route.query.limit, { fallback: 20, min: 1, max: 100 }))
  const q = ref<string>(readQueryString(route.query.q))
  const buildingFilter = ref<string>(readQueryString(route.query.building_id))
  const roomFilter = ref<string>(readQueryString(route.query.room_id))
  const tenantFilter = ref<string>(readQueryString(route.query.tenant_id))
  const status = ref<ContractStatus[]>(readQueryEnumArray(route.query.status, STATUSES))
  const sort = ref<SortField>(readQueryEnum(route.query.sort, SORT_FIELDS, 'created_at'))
  const order = ref<SortOrder>(readQueryEnum(route.query.order, SORT_ORDERS, 'desc'))

  // Backward-compat single-value status filter (kept for callers that still
  // bind a single select). Mirrors into `status` array on change.
  const statusFilter = computed<string | undefined>({
    get: () => status.value[0],
    set: (value) => {
      status.value = value ? [value as ContractStatus] : []
    },
  })


  useRouteListQuerySync({
    page,
    resetPageOn: [q, buildingFilter, roomFilter, tenantFilter, status, sort, order],
    syncOn: [page],
    parseRoute(newQuery) {
      const newPage = readQueryNumber(newQuery.page, { fallback: 1, min: 1 })
      const newLimit = readQueryNumber(newQuery.limit, { fallback: 20, min: 1, max: 100 })
      const newQ = readQueryString(newQuery.q)
      const newBuilding = readQueryString(newQuery.building_id)
      const newRoom = readQueryString(newQuery.room_id)
      const newTenant = readQueryString(newQuery.tenant_id)
      const newStatus = readQueryEnumArray(newQuery.status, STATUSES)
      const newSort = readQueryEnum(newQuery.sort, SORT_FIELDS, 'created_at')
      const newOrder = readQueryEnum(newQuery.order, SORT_ORDERS, 'desc')

      if (page.value !== newPage) page.value = newPage
      if (limit.value !== newLimit) limit.value = newLimit
      if (q.value !== newQ) q.value = newQ
      if (buildingFilter.value !== newBuilding) buildingFilter.value = newBuilding
      if (roomFilter.value !== newRoom) roomFilter.value = newRoom
      if (tenantFilter.value !== newTenant) tenantFilter.value = newTenant
      if (JSON.stringify(status.value) !== JSON.stringify(newStatus)) status.value = newStatus
      if (sort.value !== newSort) sort.value = newSort
      if (order.value !== newOrder) order.value = newOrder
    },
    buildQuery(query) {
      const next = copyStringQuery(query)

      next.page = page.value > 1 ? String(page.value) : undefined
      next.q = q.value || undefined
      next.building_id = buildingFilter.value || undefined
      next.room_id = roomFilter.value || undefined
      next.tenant_id = tenantFilter.value || undefined
      next.status = status.value.length > 0 ? status.value : undefined
      next.sort = sort.value !== 'created_at' ? sort.value : undefined
      next.order = order.value !== 'desc' ? order.value : undefined

      return next
    },
  })

  const queryParams = computed(() => ({
    page: page.value,
    limit: limit.value,
    q: q.value || undefined,
    building_id: buildingFilter.value || undefined,
    room_id: roomFilter.value || undefined,
    tenant_id: tenantFilter.value || undefined,
    status: status.value.length > 0 ? status.value : undefined,
    sort: sort.value,
    order: order.value,
  }))

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<ContractWithDetails[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/contracts', {
    key: CONTRACT_LIST_ASYNC_KEY,
    query: queryParams,
    watch: [page, limit, q, buildingFilter, roomFilter, tenantFilter, status, sort, order],
  })

  const contracts = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => fetchStatus.value === 'pending')
  const hasActiveFilters = computed(() =>
    Boolean(q.value)
    || Boolean(buildingFilter.value)
    || Boolean(roomFilter.value)
    || Boolean(tenantFilter.value)
    || status.value.length > 0
    || sort.value !== 'created_at'
    || order.value !== 'desc',
  )

  function resetFilters() {
    q.value = ''
    buildingFilter.value = ''
    roomFilter.value = ''
    tenantFilter.value = ''
    status.value = []
    sort.value = 'created_at'
    order.value = 'desc'
    page.value = 1
  }

  return {
    contracts,
    total,
    totalPages,
    page,
    limit,
    q,
    buildingFilter,
    roomFilter,
    tenantFilter,
    status,
    statusFilter,
    sort,
    order,
    hasActiveFilters,
    resetFilters,
    isLoading,
    error,
    refresh,
  }
}
