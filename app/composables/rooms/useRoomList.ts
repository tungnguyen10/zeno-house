import type { Room, RoomStatus } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'
import {
  copyStringQuery,
  readQueryEnum,
  readQueryEnumArray,
  readQueryNumber,
  readQueryString,
  useRouteListQuerySync,
} from '~/composables/useRouteListQuerySync'

export const ROOM_LIST_ASYNC_KEY = 'rooms:list'

export function invalidateRoomListCache() {
  clearNuxtData(ROOM_LIST_ASYNC_KEY)
}

type SortField = 'room_number' | 'floor' | 'monthly_rent' | 'created_at'
type SortOrder = 'asc' | 'desc'

const SORT_FIELDS: SortField[] = ['room_number', 'floor', 'monthly_rent', 'created_at']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const STATUSES: RoomStatus[] = ['available', 'occupied', 'maintenance', 'archived']

export function useRoomList() {
  const route = useRoute()

  const buildingId = ref<string | undefined>(
    typeof route.query.building_id === 'string' ? route.query.building_id : undefined,
  )
  const status = ref<RoomStatus[]>(readQueryEnumArray(route.query.status, STATUSES))
  const floor = ref<number | undefined>(
    route.query.floor !== undefined ? Number(route.query.floor) || undefined : undefined,
  )
  const page = ref(readQueryNumber(route.query.page, { fallback: 1, min: 1 }))
  const limit = ref(readQueryNumber(route.query.limit, { fallback: 20, min: 1, max: 100 }))
  const q = ref<string>(readQueryString(route.query.q))
  const sort = ref<SortField>(readQueryEnum(route.query.sort, SORT_FIELDS, 'floor'))
  const order = ref<SortOrder>(readQueryEnum(route.query.order, SORT_ORDERS, 'asc'))

  useRouteListQuerySync({
    page,
    resetPageOn: [buildingId, floor, q, status, sort, order],
    syncOn: [page, limit],
    parseRoute(newQuery) {
      const newBuildingId = typeof newQuery.building_id === 'string' ? newQuery.building_id : undefined
      const newFloor = newQuery.floor !== undefined ? Number(newQuery.floor) || undefined : undefined
      const newPage = readQueryNumber(newQuery.page, { fallback: 1, min: 1 })
      const newLimit = readQueryNumber(newQuery.limit, { fallback: 20, min: 1, max: 100 })
      const newQ = readQueryString(newQuery.q)
      const newStatus = readQueryEnumArray(newQuery.status, STATUSES)
      const newSort = readQueryEnum(newQuery.sort, SORT_FIELDS, 'floor')
      const newOrder = readQueryEnum(newQuery.order, SORT_ORDERS, 'asc')

      if (buildingId.value !== newBuildingId) buildingId.value = newBuildingId
      if (floor.value !== newFloor) floor.value = newFloor
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
      next.limit = limit.value !== 20 ? String(limit.value) : undefined
      next.q = q.value || undefined
      next.status = status.value.length > 0 ? status.value : undefined
      next.building_id = buildingId.value || undefined
      next.floor = floor.value !== undefined ? String(floor.value) : undefined
      next.sort = sort.value !== 'floor' ? sort.value : undefined
      next.order = order.value !== 'asc' ? order.value : undefined

      return next
    },
  })

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<Room[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/rooms', {
    key: ROOM_LIST_ASYNC_KEY,
    query: { building_id: buildingId, status, floor, page, limit, q, sort, order },
    watch: [buildingId, status, floor, page, limit, q, sort, order],
  })

  const rooms = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => fetchStatus.value === 'pending')
  const hasActiveFilters = computed(() =>
    Boolean(buildingId.value)
    || floor.value !== undefined
    || Boolean(q.value)
    || status.value.length > 0
    || sort.value !== 'floor'
    || order.value !== 'asc',
  )

  function resetFilters() {
    buildingId.value = undefined
    floor.value = undefined
    q.value = ''
    status.value = []
    sort.value = 'floor'
    order.value = 'asc'
    page.value = 1
  }

  return {
    rooms,
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
    buildingId,
    floor,
  }
}
