import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import type { QuickRoomInput } from '~/utils/validators/buildings'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

export function useRoomBatchCreate(buildingIdentifier: MaybeRef<string>) {
  // One id per composable instance so a retry after a lost response replays
  // instead of creating duplicate rooms.
  const requestId = crypto.randomUUID()
  const loading = ref(false)
  const apiError = ref<string | null>(null)
  const duplicateRoomNumbers = ref<string[]>([])

  async function submit(input: { rooms: QuickRoomInput[]; apply_inventory: boolean }): Promise<boolean> {
    apiError.value = null
    duplicateRoomNumbers.value = []
    loading.value = true
    const id = encodeURIComponent(toValue(buildingIdentifier))
    try {
      await apiFetch<ApiSuccess<Room[]>>(`/api/buildings/${id}/rooms/batch`, {
        method: 'POST',
        body: { request_id: requestId, rooms: input.rooms, apply_inventory: input.apply_inventory },
      })
      clearNuxtData()
      await navigateTo(`/dashboard/rooms?building_id=${id}`)
      return true
    }
    catch (cause) {
      const details = getApiErrorDetails<{ reason?: string; duplicate_room_numbers?: string[] }>(cause)
      if (details?.reason === 'ROOM_BATCH_DUPLICATE') {
        duplicateRoomNumbers.value = details.duplicate_room_numbers ?? []
        apiError.value = getApiErrorMessage(cause, 'Một số mã phòng đã tồn tại.')
      }
      else {
        apiError.value = getApiErrorMessage(cause, 'Chưa tạo được phòng. Bạn có thể bấm lại để thử.')
      }
      return false
    }
    finally {
      loading.value = false
    }
  }

  return { submit, loading, apiError, duplicateRoomNumbers, requestId }
}
