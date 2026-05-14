import type { Room } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'

export function useRoomList() {
  const buildingId = ref<string | undefined>(undefined)
  const status = ref<string | undefined>(undefined)
  const floor = ref<number | undefined>(undefined)
  const page = ref(1)
  const limit = 20

  // Reset page when filters change
  watch([buildingId, status, floor], () => { page.value = 1 })

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<Room[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/rooms', {
    query: { building_id: buildingId, status, floor, page, limit },
    watch: [buildingId, status, floor, page],
  })

  const rooms = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => fetchStatus.value === 'pending')

  return {
    rooms,
    total,
    totalPages,
    page,
    isLoading,
    error,
    refresh,
    buildingId,
    status,
    floor,
  }
}
