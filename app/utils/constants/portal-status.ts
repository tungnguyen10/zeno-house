import type { TenantSupportRequestStatus } from '~/types/tenant-portal'
import type { InvoiceStatus } from '~/utils/constants/billing'

export type PortalStatus = InvoiceStatus | TenantSupportRequestStatus
export type PortalStatusTone = 'neutral' | 'positive' | 'warning' | 'accent' | 'danger'
export type PortalStatementAccent = 'paid' | 'due' | 'overdue'

interface PortalStatusStyle {
  label: string
  tone: PortalStatusTone
  className: string
}

export const PORTAL_STATUS_STYLES = {
  draft: {
    label: 'Nháp',
    tone: 'neutral',
    className: 'bg-smoke text-body',
  },
  issued: {
    label: 'Chưa thanh toán',
    tone: 'warning',
    className: 'bg-portal-warning/10 text-portal-warning-ink',
  },
  partial: {
    label: 'Thanh toán một phần',
    tone: 'accent',
    className: 'bg-theme/10 text-theme',
  },
  paid: {
    label: 'Đã thanh toán',
    tone: 'positive',
    className: 'bg-portal-positive/10 text-portal-positive-ink',
  },
  overdue: {
    label: 'Quá hạn',
    tone: 'danger',
    className: 'bg-portal-danger/10 text-portal-danger-ink',
  },
  void: {
    label: 'Đã hủy',
    tone: 'neutral',
    className: 'bg-smoke text-body',
  },
  new: {
    label: 'Mới gửi',
    tone: 'warning',
    className: 'bg-portal-warning/10 text-portal-warning-ink',
  },
  in_progress: {
    label: 'Đang xử lý',
    tone: 'accent',
    className: 'bg-theme/10 text-theme',
  },
  resolved: {
    label: 'Đã xử lý',
    tone: 'positive',
    className: 'bg-portal-positive/10 text-portal-positive-ink',
  },
} satisfies Record<PortalStatus, PortalStatusStyle>

export function portalInvoiceStatementAccent(status: InvoiceStatus): PortalStatementAccent {
  if (status === 'paid') return 'paid'
  if (status === 'overdue') return 'overdue'
  return 'due'
}
