/**
 * Shared bulk action failure reason labels used across list pages.
 * Each domain page spreads this map and adds domain-specific entries.
 */
export const BULK_FAILURE_LABELS_COMMON: Record<string, string> = {
  has_active_contracts: 'Còn hợp đồng đang hoạt động',
  not_found: 'Không tìm thấy',
  conflict: 'Xung đột dữ liệu',
}
