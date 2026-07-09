import type { ApiSuccess } from '~/types/api'

export type RoomBulkAction = 'archive' | 'activate' | 'set_maintenance' | 'delete'

export interface RoomBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export function useRoomBulkActions() {
  const { selectedIds, isRunning, isSelected, toggle, selectAll, clear } = useBulkSelection()

  async function runAction(action: RoomBulkAction, options: { reason?: string } = {}): Promise<RoomBulkResult> {
    if (selectedIds.value.length === 0) {
      return { succeeded: [], failed: [] }
    }

    const reason = options.reason?.trim()

    isRunning.value = true
    try {
      const res = await $fetch<ApiSuccess<RoomBulkResult>>('/api/rooms/bulk', {
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
