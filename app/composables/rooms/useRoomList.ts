import type { Room } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'

export function useRoomList() {
  const buildingId = ref<string | undefined>(undefined)
  const status = ref<string | undefined>(undefined)
  const floor = ref<number | undefined>(undefined)

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<Room[]> & { meta: { total: number } }
  >('/api/rooms', {
    query: { building_id: buildingId, status, floor },
    watch: [buildingId, status, floor],
  })

  const rooms = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const isLoading = computed(() => fetchStatus.value === 'pending')

  return {
    rooms,
    total,
    isLoading,
    error,
    refresh,
    buildingId,
    status,
    floor,
  }
}
