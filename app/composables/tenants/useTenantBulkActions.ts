import type { ApiSuccess } from '~/types/api'

export type TenantBulkAction = 'archive' | 'activate' | 'delete'

export interface TenantBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export function useTenantBulkActions() {
  const { selectedIds, isRunning, isSelected, toggle, selectAll, clear } = useBulkSelection()

  async function runAction(action: TenantBulkAction, options: { reason?: string } = {}): Promise<TenantBulkResult> {
    if (selectedIds.value.length === 0) {
      return { succeeded: [], failed: [] }
    }

    const reason = options.reason?.trim()

    isRunning.value = true
    try {
      const res = await $fetch<ApiSuccess<TenantBulkResult>>('/api/tenants/bulk', {
        method: 'POST',
        body: {
          action,
          ids: selectedIds.value,
          reason: reason || undefined,
        },
      })
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
