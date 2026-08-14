import type { Room } from '~/types/rooms'
import { useResourceDetail } from '~/composables/useResourceDetail'

export function useRoomDetail(id: MaybeRef<string>) {
  const { entity, isLoading, error, refresh } = useResourceDetail<Room>(
    () => `/api/rooms/${toValue(id)}`,
  )

  return { room: entity, isLoading, error, refresh }
}
