import type { ApiSuccess } from '~/types/api'

export type BuildingBulkAction = 'archive' | 'activate' | 'delete'

export interface BuildingBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export function useBuildingBulkActions() {
  const { selectedIds, isRunning, isSelected, toggle, selectAll, clear } = useBulkSelection()

  async function runAction(action: BuildingBulkAction): Promise<BuildingBulkResult> {
    if (selectedIds.value.length === 0) {
      return { succeeded: [], failed: [] }
    }
    isRunning.value = true
    try {
      const res = await apiFetch<ApiSuccess<BuildingBulkResult>>('/api/buildings/bulk', {
        method: 'POST',
        body: { action, ids: selectedIds.value },
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
