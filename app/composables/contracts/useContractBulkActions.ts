import type { ApiSuccess } from '~/types/api'

export type ContractBulkAction = 'terminate' | 'delete'

export interface ContractBulkActionResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export function useContractBulkActions() {
  const selectedIds = ref<string[]>([])
  const isRunning = ref(false)

  function isSelected(id: string): boolean {
    return selectedIds.value.includes(id)
  }

  function toggle(id: string) {
    selectedIds.value = isSelected(id)
      ? selectedIds.value.filter(item => item !== id)
      : [...selectedIds.value, id]
  }

  function selectAll(ids: string[]) {
    selectedIds.value = [...ids]
  }

  function clear() {
    selectedIds.value = []
  }

  async function runAction(
    action: ContractBulkAction,
    opts: { reason?: string } = {},
  ): Promise<ContractBulkActionResult> {
    if (selectedIds.value.length === 0) return { succeeded: [], failed: [] }

    isRunning.value = true
    try {
      const response = await $fetch<ApiSuccess<ContractBulkActionResult>>('/api/contracts/bulk', {
        method: 'POST',
        body: {
          action,
          ids: selectedIds.value,
          ...(opts.reason ? { reason: opts.reason } : {}),
        },
      })
      return response.data
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
