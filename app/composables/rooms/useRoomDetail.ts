import type { Room } from '~/types/rooms'
import type { ApiSuccess } from '~/types/api'

export function useRoomDetail(id: string) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<Room>>(
    `/api/rooms/${id}`,
  )

  const room = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  return { room, isLoading, error, refresh }
}
