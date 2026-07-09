import type { Building, BuildingStatus } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import {
  copyStringQuery,
  readQueryEnum,
  readQueryEnumArray,
  readQueryNumber,
  readQueryString,
  useRouteListQuerySync,
} from '~/composables/useRouteListQuerySync'

export const BUILDING_LIST_ASYNC_KEY = 'buildings:list'

export function invalidateBuildingListCache() {
  clearNuxtData(BUILDING_LIST_ASYNC_KEY)
}

type SortField = 'name' | 'created_at' | 'total_rooms'
type SortOrder = 'asc' | 'desc'

const SORT_FIELDS: SortField[] = ['name', 'created_at', 'total_rooms']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const STATUSES: BuildingStatus[] = ['active', 'inactive']

export function useBuildingList() {
  const route = useRoute()

  const page = ref(readQueryNumber(route.query.page, { fallback: 1, min: 1 }))
  const limit = ref(readQueryNumber(route.query.limit, { fallback: 20, min: 1, max: 100 }))
  const q = ref<string>(readQueryString(route.query.q))
  const status = ref<BuildingStatus[]>(readQueryEnumArray(route.query.status, STATUSES))
  const sort = ref<SortField>(readQueryEnum(route.query.sort, SORT_FIELDS, 'created_at'))
  const order = ref<SortOrder>(readQueryEnum(route.query.order, SORT_ORDERS, 'desc'))

  useRouteListQuerySync({
    page,
    resetPageOn: [q, status, sort, order],
    syncOn: [page],
    parseRoute(newQuery) {
      const newPage = readQueryNumber(newQuery.page, { fallback: 1, min: 1 })
      const newLimit = readQueryNumber(newQuery.limit, { fallback: 20, min: 1, max: 100 })
      const newQ = readQueryString(newQuery.q)
      const newStatus = readQueryEnumArray(newQuery.status, STATUSES)
      const newSort = readQueryEnum(newQuery.sort, SORT_FIELDS, 'created_at')
      const newOrder = readQueryEnum(newQuery.order, SORT_ORDERS, 'desc')

      if (page.value !== newPage) page.value = newPage
      if (limit.value !== newLimit) limit.value = newLimit
      if (q.value !== newQ) q.value = newQ
      if (JSON.stringify(status.value) !== JSON.stringify(newStatus)) status.value = newStatus
      if (sort.value !== newSort) sort.value = newSort
      if (order.value !== newOrder) order.value = newOrder
    },
    buildQuery(query) {
      const next = copyStringQuery(query)

      next.page = page.value > 1 ? String(page.value) : undefined
      next.q = q.value || undefined
      next.status = status.value.length > 0 ? status.value : undefined
      next.sort = sort.value !== 'created_at' ? sort.value : undefined
      next.order = order.value !== 'desc' ? order.value : undefined

      return next
    },
  })

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<Building[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/buildings', {
    key: BUILDING_LIST_ASYNC_KEY,
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
