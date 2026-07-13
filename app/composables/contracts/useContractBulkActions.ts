import type { ApiSuccess } from '~/types/api'

export type ContractBulkAction = 'terminate' | 'delete'

export interface ContractBulkActionResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

export function useContractBulkActions() {
  const { selectedIds, isRunning, isSelected, toggle, selectAll, clear } = useBulkSelection()

  async function runAction(
    action: ContractBulkAction,
    opts: { reason?: string } = {},
  ): Promise<ContractBulkActionResult> {
    if (selectedIds.value.length === 0) return { succeeded: [], failed: [] }

    const reason = opts.reason?.trim()

    isRunning.value = true
    try {
      const response = await apiFetch<ApiSuccess<ContractBulkActionResult>>('/api/contracts/bulk', {
        method: 'POST',
        body: {
          action,
          ids: selectedIds.value,
          reason: reason || undefined,
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
