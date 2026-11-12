import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import type { ApiSuccess } from '~/types/api'
import type { InventoryItem } from '~/types/inventory'
import { getApiErrorMessage } from '~/utils/api-error'
import type { InventoryItemInput } from '~/utils/validators/inventory'

interface UseRoomInventoryOptions {
  roomId: MaybeRefOrGetter<string>
  buildingId: MaybeRefOrGetter<string>
  initial?: InventoryItem[]
}

export function useRoomInventory(roomIdentifier: string, options: UseRoomInventoryOptions) {
  const items = ref<InventoryItem[]>(options.initial ?? [])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const url = `/api/rooms/${roomIdentifier}/inventory`

  async function load() {
    loading.value = true
    error.value = null
    try {
      items.value = (await apiFetch<ApiSuccess<InventoryItem[]>>(url)).data
    }
    catch (e: unknown) {
      error.value = getApiErrorMessage(e, 'Không tải được nội thất của phòng.')
    }
    finally {
      loading.value = false
    }
  }

  async function save(next: InventoryItemInput[]): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      items.value = (await apiFetch<ApiSuccess<InventoryItem[]>>(url, { method: 'PUT', body: { items: next } })).data
      return true
    }
    catch (e: unknown) {
      error.value = getApiErrorMessage(e, 'Không lưu được nội thất của phòng.')
      return false
    }
    finally {
      saving.value = false
    }
  }

  async function applyTemplate(): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      await apiFetch(`/api/buildings/${toValue(options.buildingId)}/inventory-template/apply`, {
        method: 'POST',
        body: { room_ids: [toValue(options.roomId)], mode: 'merge' },
      })
    }
    catch (e: unknown) {
      error.value = getApiErrorMessage(e, 'Không áp dụng được nội thất mẫu.')
      return false
    }
    finally {
      saving.value = false
    }
    await load()
    return !error.value
  }

  return { items, loading, saving, error, load, save, applyTemplate }
}
