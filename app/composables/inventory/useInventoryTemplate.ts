import type { ApiSuccess } from '~/types/api'
import type { InventoryItem } from '~/types/inventory'
import { getApiErrorMessage } from '~/utils/api-error'
import type { InventoryApplyInput, InventoryItemInput } from '~/utils/validators/inventory'

export interface InventoryApplyResult {
  appliedRooms: number
  addedItems: number
}

export function useInventoryTemplate(buildingIdentifier: string, options: { initial?: InventoryItem[] } = {}) {
  const items = ref<InventoryItem[]>(options.initial ?? [])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const url = `/api/buildings/${buildingIdentifier}/inventory-template`

  async function load() {
    loading.value = true
    error.value = null
    try {
      items.value = (await apiFetch<ApiSuccess<InventoryItem[]>>(url)).data
    }
    catch (e: unknown) {
      error.value = getApiErrorMessage(e, 'Không tải được nội thất mẫu.')
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
      error.value = getApiErrorMessage(e, 'Không lưu được nội thất mẫu.')
      return false
    }
    finally {
      saving.value = false
    }
  }

  async function apply(input: InventoryApplyInput): Promise<InventoryApplyResult | null> {
    saving.value = true
    error.value = null
    try {
      return (await apiFetch<ApiSuccess<InventoryApplyResult>>(`${url}/apply`, { method: 'POST', body: input })).data
    }
    catch (e: unknown) {
      error.value = getApiErrorMessage(e, 'Không áp dụng được nội thất mẫu.')
      return null
    }
    finally {
      saving.value = false
    }
  }

  return { items, loading, saving, error, load, save, apply }
}
