/**
 * Semantic status mapping for design system.
 *
 * Pages must NOT inline color classes for domain status — always go through this map.
 * Add new statuses here when a domain introduces them.
 */

export type StatusVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export interface StatusDef {
  /** Vietnamese label rendered in `UiStatusBadge`. */
  label: string
  /** Semantic variant — `UiBadge` translates this to dark theme classes. */
  variant: StatusVariant
}

/**
 * Domain entity statuses (rooms, contracts, tenants).
 */
export const ENTITY_STATUSES: Record<string, StatusDef> = {
  // Common entity lifecycle
  active: { label: 'Đang hoạt động', variant: 'success' },
  inactive: { label: 'Ngừng hoạt động', variant: 'neutral' },
  pending: { label: 'Chờ duyệt', variant: 'warning' },
  terminated: { label: 'Đã chấm dứt', variant: 'danger' },
  expired: { label: 'Hết hạn', variant: 'warning' },

  // Room
  available: { label: 'Trống', variant: 'success' },
  vacant: { label: 'Trống', variant: 'success' },
  occupied: { label: 'Đã có người thuê', variant: 'accent' },
  maintenance: { label: 'Đang bảo trì', variant: 'warning' },
  archived: { label: 'Đã lưu trữ', variant: 'neutral' },
}

/**
 * Billing period statuses for `monthly-operations-workspace`.
 *
 * Lifecycle: draft → readings → review → issued → collecting → closed
 */
export const BILLING_PERIOD_STATUSES: Record<string, StatusDef> = {
  draft: { label: 'Nháp', variant: 'neutral' },
  readings: { label: 'Đang ghi chỉ số', variant: 'accent' },
  review: { label: 'Cần soát lại', variant: 'warning' },
  issued: { label: 'Đã phát hành', variant: 'accent' },
  collecting: { label: 'Đang thu', variant: 'accent' },
  closed: { label: 'Đã đóng', variant: 'success' },
}

/**
 * Invoice statuses for `monthly-operations-workspace`.
 */
export const INVOICE_STATUSES: Record<string, StatusDef> = {
  draft: { label: 'Nháp', variant: 'neutral' },
  issued: { label: 'Đã phát hành', variant: 'accent' },
  partial: { label: 'Thu một phần', variant: 'warning' },
  paid: { label: 'Đã thu', variant: 'success' },
  overdue: { label: 'Quá hạn', variant: 'danger' },
  void: { label: 'Đã huỷ', variant: 'danger' },
}

/**
 * Correction / blocker / audit markers used across billing surfaces.
 */
export const CORRECTION_STATUSES: Record<string, StatusDef> = {
  blocked: { label: 'Bị chặn', variant: 'danger' },
  warning: { label: 'Cảnh báo', variant: 'warning' },
  adjustment: { label: 'Điều chỉnh', variant: 'warning' },
  replacement: { label: 'Thay thế', variant: 'warning' },
  corrected: { label: 'Đã hiệu chỉnh', variant: 'accent' },
  missing_reading: { label: 'Thiếu chỉ số', variant: 'warning' },
  ready: { label: 'Sẵn sàng', variant: 'success' },
  baseline: { label: 'Không lập hoá đơn', variant: 'neutral' },
}

/**
 * Combined map used by `UiStatusBadge` when no `context` is supplied.
 *
 * Merge order is intentional — entries earlier in the spread win on key collision.
 * For example `draft` and `issued` exist in both billing period and invoice contexts.
 * The period definitions land last here so callers without context default to the
 * billing period semantics. To force invoice/correction semantics, pass `context`.
 */
export const STATUS_MAP: Record<string, StatusDef> = {
  ...ENTITY_STATUSES,
  ...INVOICE_STATUSES,
  ...CORRECTION_STATUSES,
  ...BILLING_PERIOD_STATUSES,
}

/** Context used to disambiguate keys that exist in multiple status maps. */
export type StatusContext = 'entity' | 'period' | 'invoice' | 'correction'

const CONTEXT_MAPS: Record<StatusContext, Record<string, StatusDef>> = {
  entity: ENTITY_STATUSES,
  period: BILLING_PERIOD_STATUSES,
  invoice: INVOICE_STATUSES,
  correction: CORRECTION_STATUSES,
}

/** Fallback definition when the requested key is unknown. */
export const UNKNOWN_STATUS: StatusDef = {
  label: 'Không xác định',
  variant: 'neutral',
}

/**
 * Resolve a status key to its label/variant.
 *
 * Without `context`, falls back to the merged `STATUS_MAP`.
 * With `context`, looks up the dedicated map first and falls back to the merged map
 * so callers can still pass keys that only exist in entity statuses.
 */
export function resolveStatus(status: string, context?: StatusContext): StatusDef {
  if (context) {
    const scoped = CONTEXT_MAPS[context][status]
    if (scoped) return scoped
  }
  return STATUS_MAP[status] ?? { ...UNKNOWN_STATUS, label: status }
}
