import type { RoomAssignmentWithTenant } from '~/types/room-assignments'
import type { ApiSuccess } from '~/types/api'
import type { AssignInput } from '~/utils/validators/room-assignments'

export function useRoomAssignment(roomId: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<RoomAssignmentWithTenant | null>>(
    computed(() => `/api/room-assignments/room/${unref(roomId)}`),
  )

  const assignment = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  async function assign(input: AssignInput): Promise<void> {
    await $fetch('/api/room-assignments', { method: 'POST', body: input })
    await refresh()
  }

  async function unassign(id: string): Promise<void> {
    await $fetch(`/api/room-assignments/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return { assignment, isLoading, error, refresh, assign, unassign }
}
