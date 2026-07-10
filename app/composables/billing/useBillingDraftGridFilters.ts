import { computed, ref, type ComputedRef } from 'vue'
import type { BillingDraftGridRow } from '~/types/billing'

export type BillingDraftGridFilter = 'needs_action' | 'all' | 'vacant' | 'errors' | 'ready'

export const billingDraftGridFilterTabs: Array<{ key: BillingDraftGridFilter; label: string }> = [
  { key: 'needs_action', label: 'Cần xử lý' },
  { key: 'all', label: 'Tất cả' },
  { key: 'vacant', label: 'Phòng trống' },
  { key: 'errors', label: 'Có lỗi' },
  { key: 'ready', label: 'Đã sẵn sàng' },
]

export function useBillingDraftGridFilters(rows: ComputedRef<BillingDraftGridRow[]>) {
  const filter = ref<BillingDraftGridFilter>('needs_action')
  const detailRowKey = ref<string | null>(null)

  const filteredRows = computed<BillingDraftGridRow[]>(() => {
    switch (filter.value) {
      case 'all':
        return rows.value
      case 'vacant':
        return rows.value.filter(row => row.rowType === 'vacant_baseline')
      case 'errors':
        return rows.value.filter(row => row.status === 'blocked' || row.status === 'missing_reading' || row.status === 'warning')
      case 'ready':
        return rows.value.filter(row => row.status === 'ready')
      case 'needs_action':
      default:
        return rows.value.filter((row) => {
          if (row.rowType === 'vacant_baseline') return false
          if (row.status === 'paid' || row.status === 'partial' || row.status === 'issued') return false
          return true
        })
    }
  })

  const detailRow = computed<BillingDraftGridRow | null>(() => {
    const key = detailRowKey.value
    if (!key) return null
    return rows.value.find(row => row.key === key) ?? null
  })

  function isDetailOpen(row: BillingDraftGridRow): boolean {
    return detailRowKey.value === row.key
  }

  function openDetail(row: BillingDraftGridRow) {
    detailRowKey.value = row.key
  }

  function closeDetail() {
    detailRowKey.value = null
  }

  function toggleDetail(row: BillingDraftGridRow) {
    if (detailRowKey.value === row.key) closeDetail()
    else openDetail(row)
  }

  // ---------------------------------------------------------------------------
  // Multi-row selection (for batch actions like print)
  // ---------------------------------------------------------------------------

  const selectedKeys = ref<Set<string>>(new Set())

  function isSelectable(row: BillingDraftGridRow): boolean {
    return row.rowType === 'billable_contract' && row.lines.length > 0
  }

  const selectedRows = computed<BillingDraftGridRow[]>(() => {
    return rows.value.filter(row => selectedKeys.value.has(row.key) && isSelectable(row))
  })

  const selectedCount = computed(() => selectedRows.value.length)

  const allVisibleSelected = computed(() => {
    const eligible = filteredRows.value.filter(isSelectable)
    if (eligible.length === 0) return false
    return eligible.every(row => selectedKeys.value.has(row.key))
  })

  const someVisibleSelected = computed(() => {
    const eligible = filteredRows.value.filter(isSelectable)
    if (eligible.length === 0) return false
    const selectedCount = eligible.reduce((acc, row) => acc + (selectedKeys.value.has(row.key) ? 1 : 0), 0)
    return selectedCount > 0 && selectedCount < eligible.length
  })

  function isSelected(row: BillingDraftGridRow): boolean {
    return selectedKeys.value.has(row.key)
  }

  function toggleSelect(row: BillingDraftGridRow) {
    if (!isSelectable(row)) return
    const next = new Set(selectedKeys.value)
    if (next.has(row.key)) next.delete(row.key)
    else next.add(row.key)
    selectedKeys.value = next
  }

  function selectAllVisible() {
    const next = new Set(selectedKeys.value)
    for (const row of filteredRows.value) {
      if (isSelectable(row)) next.add(row.key)
    }
    selectedKeys.value = next
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected.value) {
      const next = new Set(selectedKeys.value)
      for (const row of filteredRows.value) {
        if (isSelectable(row)) next.delete(row.key)
      }
      selectedKeys.value = next
    }
    else {
      selectAllVisible()
    }
  }

  function clearSelection() {
    selectedKeys.value = new Set()
  }

  return {
    filter,
    filterTabs: billingDraftGridFilterTabs,
    filteredRows,
    detailRow,
    detailRowKey,
    isDetailOpen,
    openDetail,
    closeDetail,
    toggleDetail,
    // selection
    selectedKeys,
    selectedRows,
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    isSelectable,
    isSelected,
    toggleSelect,
    selectAllVisible,
    toggleSelectAllVisible,
    clearSelection,
  }
}
