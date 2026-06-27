import type { ApiSuccess } from '~/types/api'

export type TenantBulkAction = 'archive' | 'activate' | 'delete'

export interface TenantBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export function useTenantBulkActions() {
  const selectedIds = ref<string[]>([])
  const isRunning = ref(false)

  function isSelected(id: string) {
    return selectedIds.value.includes(id)
  }

  function toggle(id: string) {
    if (isSelected(id)) {
      selectedIds.value = selectedIds.value.filter(x => x !== id)
    }
    else {
      selectedIds.value = [...selectedIds.value, id]
    }
  }

  function selectAll(ids: string[]) {
    selectedIds.value = [...ids]
  }

  function clear() {
    selectedIds.value = []
  }

  async function runAction(action: TenantBulkAction): Promise<TenantBulkResult> {
    if (selectedIds.value.length === 0) {
      return { succeeded: [], failed: [] }
    }
    isRunning.value = true
    try {
      const res = await $fetch<ApiSuccess<TenantBulkResult>>('/api/tenants/bulk', {
        method: 'POST',
        body: { action, ids: selectedIds.value },
      })
      clear()
      return res.data
    }
    finally {
      isRunning.value = false
    }
  }

  return {
    selectedIds,
    isRunning,
    isSelected,
    toggle,
    selectAll,
    clear,
    runAction,
  }
}
