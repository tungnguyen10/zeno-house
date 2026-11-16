import type { ApiSuccess } from '~/types/api'
import type { InventoryItem } from '~/types/inventory'
import type { InventoryApplyInput, InventoryItemInput } from '~/utils/validators/inventory'
import { getApiErrorMessage } from '~/utils/api-error'

export interface InventoryApplyResult { appliedRooms: number; addedItems: number }

export function useInventoryTemplate(
  buildingIdentifier: MaybeRef<string>,
  options: { initial?: InventoryItem[] } = {},
) {
  const items = ref<InventoryItem[]>(options.initial ?? [])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const basePath = () => `/api/buildings/${encodeURIComponent(toValue(buildingIdentifier))}/inventory-template`

  async function save(next: InventoryItemInput[]): Promise<InventoryItem[]> {
    error.value = null
    saving.value = true
    try {
      const response = await apiFetch<ApiSuccess<InventoryItem[]>>(basePath(), { method: 'PUT', body: { items: next } })
      items.value = response.data
      return response.data
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không thể lưu nội thất mẫu. Vui lòng thử lại.')
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  async function apply(input: InventoryApplyInput): Promise<InventoryApplyResult> {
    error.value = null
    const response = await apiFetch<ApiSuccess<InventoryApplyResult>>(`${basePath()}/apply`, { method: 'POST', body: input })
    return response.data
  }

  return { items, loading, saving, error, save, apply }
}
