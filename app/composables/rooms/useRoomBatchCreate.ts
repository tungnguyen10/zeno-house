import type { ApiSuccess } from '~/types/api'
import type { Room } from '~/types/rooms'
import { getApiErrorDetails } from '~/utils/api-error'
import type { ApiErrorLike } from '~/utils/api-error'
import { useFormState } from '~/composables/useFormState'
import type { QuickRoomInput } from '~/utils/validators/buildings'
import { roomBatchCreateSchema } from '~/utils/validators/inventory'

export function useRoomBatchCreate(buildingIdentifier: string) {
  const { isLoading, apiError, clearErrors, applyApiError } = useFormState()
  // Retries in this form session replay the same idempotent operation.
  const requestId = crypto.randomUUID()
  const duplicateRoomNumbers = ref<string[]>([])

  async function submit(input: { rooms: QuickRoomInput[], apply_inventory: boolean }): Promise<boolean> {
    clearErrors()
    duplicateRoomNumbers.value = []
    const parsed = roomBatchCreateSchema.safeParse({ ...input, request_id: requestId })
    if (!parsed.success) {
      apiError.value = parsed.error.issues[0]?.message ?? 'Danh sách phòng không hợp lệ.'
      return false
    }

    isLoading.value = true
    try {
      await apiFetch<ApiSuccess<Room[]>>(`/api/buildings/${buildingIdentifier}/rooms/batch`, {
        method: 'POST',
        body: parsed.data,
      })
      clearNuxtData()
      await navigateTo(`/dashboard/rooms?building_id=${encodeURIComponent(buildingIdentifier)}`)
      return true
    }
    catch (e: unknown) {
      applyApiError(e)
      const details = getApiErrorDetails<{ reason?: string, duplicate_room_numbers?: string[] }>(e)
      if (details?.reason === 'ROOM_BATCH_DUPLICATE') duplicateRoomNumbers.value = details.duplicate_room_numbers ?? []
      const error = e as (ApiErrorLike & { cause?: ApiErrorLike }) | null
      const statusCode = error?.statusCode ?? error?.cause?.statusCode
      if (statusCode === undefined || statusCode >= 500) {
        apiError.value = 'Chưa xác nhận được kết quả. Bấm thử lại để kiểm tra và tiếp tục.'
      }
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  return { submit, loading: isLoading, apiError, duplicateRoomNumbers, requestId }
}
