import { computed, ref, type ComputedRef } from 'vue'
import type { BillingDraftGridResponse, BillingDraftGridRow } from '~/types/billing'

export type BillingDraftGridFilter = 'needs_action' | 'all' | 'vacant' | 'errors' | 'ready'

export const billingDraftGridFilterTabs: Array<{ key: BillingDraftGridFilter; label: string }> = [
  { key: 'needs_action', label: 'Cần xử lý' },
  { key: 'all', label: 'Tất cả' },
  { key: 'vacant', label: 'Phòng trống' },
  { key: 'errors', label: 'Có lỗi' },
  { key: 'ready', label: 'Đã sẵn sàng' },
]

export function useBillingDraftGridFilters(response: ComputedRef<BillingDraftGridResponse | null>) {
  const filter = ref<BillingDraftGridFilter>('needs_action')
  const detailRowKey = ref<string | null>(null)

  const filteredRows = computed<BillingDraftGridRow[]>(() => {
    const rows = response.value?.rows ?? []
    switch (filter.value) {
      case 'all':
        return rows
      case 'vacant':
        return rows.filter(row => row.rowType === 'vacant_baseline')
      case 'errors':
        return rows.filter(row => row.blockers.length > 0)
      case 'ready':
        return rows.filter(row => row.status === 'ready')
      case 'needs_action':
      default:
        return rows.filter((row) => {
          if (row.rowType === 'vacant_baseline') return false
          if (row.status === 'paid' || row.status === 'partial' || row.status === 'issued') return false
          return true
        })
    }
  })

  const detailRow = computed<BillingDraftGridRow | null>(() => {
    const key = detailRowKey.value
    if (!key) return null
    return response.value?.rows.find(row => row.key === key) ?? null
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
  }
}
