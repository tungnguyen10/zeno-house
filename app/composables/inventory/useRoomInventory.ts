import type { ApiSuccess } from '~/types/api'
import type { InventoryItem } from '~/types/inventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'
import type { InventoryApplyResult } from '~/composables/inventory/useInventoryTemplate'
import { getApiErrorMessage } from '~/utils/api-error'

export function useRoomInventory(
  roomIdentifier: MaybeRef<string>,
  options: { roomId: string; buildingId: string; initial?: InventoryItem[] },
) {
  const items = ref<InventoryItem[]>(options.initial ?? [])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function save(next: InventoryItemInput[]): Promise<InventoryItem[]> {
    error.value = null
    saving.value = true
    try {
      const response = await apiFetch<ApiSuccess<InventoryItem[]>>(
        `/api/rooms/${encodeURIComponent(toValue(roomIdentifier))}/inventory`,
        { method: 'PUT', body: { items: next } },
      )
      items.value = response.data
      return response.data
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không thể lưu nội thất phòng. Vui lòng thử lại.')
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  async function applyTemplate(): Promise<InventoryApplyResult> {
    error.value = null
    loading.value = true
    try {
      const response = await apiFetch<ApiSuccess<InventoryApplyResult>>(
        `/api/buildings/${encodeURIComponent(options.buildingId)}/inventory-template/apply`,
        { method: 'POST', body: { room_ids: [options.roomId], mode: 'merge' } },
      )
      const refreshed = await apiFetch<ApiSuccess<InventoryItem[]>>(
        `/api/rooms/${encodeURIComponent(toValue(roomIdentifier))}/inventory`,
      )
      items.value = refreshed.data
      return response.data
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không áp dụng được nội thất mẫu.')
      throw cause
    }
    finally {
      loading.value = false
    }
  }

  return { items, loading, saving, error, save, applyTemplate }
}
