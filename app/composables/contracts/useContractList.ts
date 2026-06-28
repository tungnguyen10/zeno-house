import type { ContractStatus, ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'

type SortField = 'start_date' | 'end_date' | 'created_at' | 'monthly_rent'
type SortOrder = 'asc' | 'desc'

const SORT_FIELDS: SortField[] = ['start_date', 'end_date', 'created_at', 'monthly_rent']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const STATUSES: ContractStatus[] = ['active', 'expired', 'terminated', 'renewed']

function readStatuses(raw: unknown): ContractStatus[] {
  const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  return arr
    .map(v => String(v))
    .filter((v): v is ContractStatus => (STATUSES as string[]).includes(v))
}

function readSortField(raw: unknown): SortField {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_FIELDS as string[]).includes(v) ? (v as SortField) : 'created_at'
}

function readSortOrder(raw: unknown): SortOrder {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_ORDERS as string[]).includes(v) ? (v as SortOrder) : 'desc'
}

export function useContractList() {
  const route = useRoute()
  const router = useRouter()

  const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
  const limit = ref(Math.min(100, Math.max(1, Number(route.query.limit ?? 20) || 20)))
  const q = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')
  const buildingFilter = ref<string>(typeof route.query.building_id === 'string' ? route.query.building_id : '')
  const roomFilter = ref<string>(typeof route.query.room_id === 'string' ? route.query.room_id : '')
  const tenantFilter = ref<string>(typeof route.query.tenant_id === 'string' ? route.query.tenant_id : '')
  const status = ref<ContractStatus[]>(readStatuses(route.query.status))
  const sort = ref<SortField>(readSortField(route.query.sort))
  const order = ref<SortOrder>(readSortOrder(route.query.order))

  // Backward-compat single-value status filter (kept for callers that still
  // bind a single select). Mirrors into `status` array on change.
  const statusFilter = computed<string | undefined>({
    get: () => status.value[0],
    set: (value) => {
      status.value = value ? [value as ContractStatus] : []
    },
  })

  let syncingFromRoute = false

  function pushToRoute() {
    const next: Record<string, string | string[] | undefined> = {}

    for (const [k, v] of Object.entries(route.query)) {
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
    next.q = q.value ? q.value : undefined
    next.building_id = buildingFilter.value ? buildingFilter.value : undefined
    next.room_id = roomFilter.value ? roomFilter.value : undefined
    next.tenant_id = tenantFilter.value ? tenantFilter.value : undefined
    next.status = status.value.length > 0 ? status.value : undefined
    next.sort = sort.value !== 'created_at' ? sort.value : undefined
    next.order = order.value !== 'desc' ? order.value : undefined

    const clean: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue
      clean[k] = v
    }

    router.replace({ query: clean })
  }

  watch([q, buildingFilter, roomFilter, tenantFilter, status, sort, order], () => {
    if (syncingFromRoute) return
    if (page.value !== 1) page.value = 1
    pushToRoute()
  }, { deep: true })

  watch(page, () => {
    if (syncingFromRoute) return
    pushToRoute()
  })

  watch(() => route.query, (newQuery) => {
    syncingFromRoute = true
    const newPage = Math.max(1, Number(newQuery.page ?? 1) || 1)
    const newLimit = Math.min(100, Math.max(1, Number(newQuery.limit ?? 20) || 20))
    const newQ = typeof newQuery.q === 'string' ? newQuery.q : ''
    const newBuilding = typeof newQuery.building_id === 'string' ? newQuery.building_id : ''
    const newRoom = typeof newQuery.room_id === 'string' ? newQuery.room_id : ''
    const newTenant = typeof newQuery.tenant_id === 'string' ? newQuery.tenant_id : ''
    const newStatus = readStatuses(newQuery.status)
    const newSort = readSortField(newQuery.sort)
    const newOrder = readSortOrder(newQuery.order)

    if (page.value !== newPage) page.value = newPage
    if (limit.value !== newLimit) limit.value = newLimit
    if (q.value !== newQ) q.value = newQ
    if (buildingFilter.value !== newBuilding) buildingFilter.value = newBuilding
    if (roomFilter.value !== newRoom) roomFilter.value = newRoom
    if (tenantFilter.value !== newTenant) tenantFilter.value = newTenant
    if (JSON.stringify(status.value) !== JSON.stringify(newStatus)) status.value = newStatus
    if (sort.value !== newSort) sort.value = newSort
    if (order.value !== newOrder) order.value = newOrder

    nextTick(() => {
      syncingFromRoute = false
    })
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
