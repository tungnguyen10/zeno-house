import { ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { ApiSuccess } from '~/types/api'
import type { HandoverInventory, InventoryItem } from '~/types/inventory'
import { inventoryListSchema, type InventoryItemInput } from '~/utils/validators/inventory'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

export function useContractHandoverInventory(contractId: MaybeRefOrGetter<string>) {
  const data = ref<HandoverInventory | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const importing = ref(false)
  const error = ref<string | null>(null)
  const errors = ref<Record<string, string>>({})
  const serverLocked = ref(false)
  let generation = 0
  const base = () => `/api/contracts/${encodeURIComponent(toValue(contractId))}/handover-inventory`

  async function load() {
    const current = ++generation
    data.value = null
    serverLocked.value = false
    loading.value = true
    error.value = null
    try {
      const response = await apiFetch<ApiSuccess<HandoverInventory>>(base())
      if (current === generation) data.value = response.data
    }
    catch (cause) {
      if (current === generation) error.value = getApiErrorMessage(cause, 'Không tải được dữ liệu bàn giao. Vui lòng thử lại.')
    }
    finally {
      if (current === generation) loading.value = false
    }
  }

  function toDraft(items: InventoryItem[]): InventoryItemInput[] {
    return items.map(item => ({ name: item.name, quantity: item.quantity, condition: item.condition, unit_value: item.unitValue, note: item.note }))
  }

  async function fromRoom(roomId: string): Promise<InventoryItemInput[] | null> {
    if (importing.value || saving.value) return null
    const current = generation
    importing.value = true
    error.value = null
    try {
      const response = await apiFetch<ApiSuccess<InventoryItem[]>>(`/api/rooms/${encodeURIComponent(roomId)}/inventory`)
      return current === generation ? toDraft(response.data) : null
    }
    catch (cause) {
      if (current === generation) error.value = getApiErrorMessage(cause, 'Không tải được nội thất phòng. Danh sách đang sửa vẫn được giữ lại.')
      return null
    }
    finally {
      importing.value = false
    }
  }

  async function save(items: InventoryItemInput[]): Promise<boolean> {
    if (saving.value || importing.value || serverLocked.value) return false
    error.value = null
    errors.value = {}
    const parsed = inventoryListSchema.safeParse(items)
    if (!parsed.success) {
      parsed.error.issues.forEach(issue => { errors.value[issue.path.join('.')] = issue.message })
      error.value = parsed.error.issues[0]?.message ?? 'Danh sách bàn giao không hợp lệ.'
      return false
    }
    const current = generation
    saving.value = true
    try {
      const response = await apiFetch<ApiSuccess<HandoverInventory>>(base(), { method: 'PUT', body: { items: parsed.data } })
      if (current !== generation) return false
      data.value = response.data
      return true
    }
    catch (cause) {
      if (current === generation) {
        serverLocked.value = getApiErrorDetails<{ reason?: string }>(cause)?.reason === 'CONTRACT_INVENTORY_LOCKED'
        error.value = getApiErrorMessage(cause, 'Không thể lưu nội thất bàn giao. Vui lòng thử lại.')
      }
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { data, loading, saving, importing, error, errors, serverLocked, load, save, fromRoom, toDraft }
}
