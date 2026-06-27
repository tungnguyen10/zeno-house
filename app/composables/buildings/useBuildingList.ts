import type { Building, BuildingStatus } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

type SortField = 'name' | 'created_at' | 'total_rooms'
type SortOrder = 'asc' | 'desc'

const SORT_FIELDS: SortField[] = ['name', 'created_at', 'total_rooms']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const STATUSES: BuildingStatus[] = ['active', 'inactive']

function readStatuses(raw: unknown): BuildingStatus[] {
  const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  return arr
    .map(v => String(v))
    .filter((v): v is BuildingStatus => (STATUSES as string[]).includes(v))
}

function readSortField(raw: unknown): SortField {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_FIELDS as string[]).includes(v) ? (v as SortField) : 'created_at'
}

function readSortOrder(raw: unknown): SortOrder {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_ORDERS as string[]).includes(v) ? (v as SortOrder) : 'desc'
}

export function useBuildingList() {
  const route = useRoute()
  const router = useRouter()

  const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
  const limit = ref(Math.min(100, Math.max(1, Number(route.query.limit ?? 20) || 20)))
  const q = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')
  const status = ref<BuildingStatus[]>(readStatuses(route.query.status))
  const sort = ref<SortField>(readSortField(route.query.sort))
  const order = ref<SortOrder>(readSortOrder(route.query.order))

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

  watch([q, status, sort, order], () => {
    if (syncingFromRoute) return
    if (page.value !== 1) {
      page.value = 1
      // page watcher will trigger pushToRoute as well; consolidate by calling here too
    }
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
    const newStatus = readStatuses(newQuery.status)
    const newSort = readSortField(newQuery.sort)
    const newOrder = readSortOrder(newQuery.order)

    if (page.value !== newPage) page.value = newPage
    if (limit.value !== newLimit) limit.value = newLimit
    if (q.value !== newQ) q.value = newQ
    if (JSON.stringify(status.value) !== JSON.stringify(newStatus)) status.value = newStatus
    if (sort.value !== newSort) sort.value = newSort
    if (order.value !== newOrder) order.value = newOrder

    nextTick(() => {
      syncingFromRoute = false
    })
  })

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<Building[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/buildings', {
    query: { page, limit, q, status, sort, order },
    watch: [page, limit, q, status, sort, order],
  })

  const buildings = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => fetchStatus.value === 'pending')
  const hasActiveFilters = computed(() =>
    Boolean(q.value)
    || status.value.length > 0
    || sort.value !== 'created_at'
    || order.value !== 'desc',
  )

  function resetFilters() {
    q.value = ''
    status.value = []
    sort.value = 'created_at'
    order.value = 'desc'
    page.value = 1
  }

  return {
    buildings,
    total,
    totalPages,
    page,
    limit,
    q,
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
