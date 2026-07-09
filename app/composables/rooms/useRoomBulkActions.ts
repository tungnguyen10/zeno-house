import type { ApiSuccess } from '~/types/api'

export type RoomBulkAction = 'archive' | 'activate' | 'set_maintenance' | 'delete'

export interface RoomBulkResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

interface RoomBulkActionOptions {
  reason?: string
}

export function useRoomBulkActions() {
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

  async function runAction(action: RoomBulkAction, options: RoomBulkActionOptions = {}): Promise<RoomBulkResult> {
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
