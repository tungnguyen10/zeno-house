import type { Room, RoomStatus } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'
import { useRouteListQuerySync } from '~/composables/useRouteListQuerySync'

export const ROOM_LIST_ASYNC_KEY = 'rooms:list'

export function invalidateRoomListCache() {
  clearNuxtData(ROOM_LIST_ASYNC_KEY)
}

type SortField = 'room_number' | 'floor' | 'monthly_rent' | 'created_at'
type SortOrder = 'asc' | 'desc'

const SORT_FIELDS: SortField[] = ['room_number', 'floor', 'monthly_rent', 'created_at']
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']
const STATUSES: RoomStatus[] = ['available', 'occupied', 'maintenance', 'archived']

function readStatuses(raw: unknown): RoomStatus[] {
  const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  return arr
    .map(v => String(v))
    .filter((v): v is RoomStatus => (STATUSES as string[]).includes(v))
}

function readSortField(raw: unknown): SortField {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_FIELDS as string[]).includes(v) ? (v as SortField) : 'floor'
}

function readSortOrder(raw: unknown): SortOrder {
  const v = typeof raw === 'string' ? raw : ''
  return (SORT_ORDERS as string[]).includes(v) ? (v as SortOrder) : 'asc'
}

export function useRoomList() {
  const route = useRoute()

  const buildingId = ref<string | undefined>(
    typeof route.query.building_id === 'string' ? route.query.building_id : undefined,
  )
  const status = ref<RoomStatus[]>(readStatuses(route.query.status))
  const floor = ref<number | undefined>(
    route.query.floor !== undefined ? Number(route.query.floor) || undefined : undefined,
  )
  const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
  const limit = ref(Math.min(100, Math.max(1, Number(route.query.limit ?? 20) || 20)))
  const q = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')
  const sort = ref<SortField>(readSortField(route.query.sort))
  const order = ref<SortOrder>(readSortOrder(route.query.order))

  useRouteListQuerySync({
    page,
    resetPageOn: [buildingId, floor, q, status, sort, order],
    syncOn: [page, limit],
    parseRoute(newQuery) {
      const newBuildingId = typeof newQuery.building_id === 'string' ? newQuery.building_id : undefined
      const newFloor = newQuery.floor !== undefined ? Number(newQuery.floor) || undefined : undefined
      const newPage = Math.max(1, Number(newQuery.page ?? 1) || 1)
      const newLimit = Math.min(100, Math.max(1, Number(newQuery.limit ?? 20) || 20))
      const newQ = typeof newQuery.q === 'string' ? newQuery.q : ''
      const newStatus = readStatuses(newQuery.status)
      const newSort = readSortField(newQuery.sort)
      const newOrder = readSortOrder(newQuery.order)

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
