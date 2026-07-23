export const INVOICE_EMAIL_DELIVERY_STATUSES = [
  'queued',
  'processing',
  'accepted',
  'delivered',
  'failed',
  'bounced',
  'complained',
  'skipped',
] as const

export type InvoiceEmailDeliveryStatus =
  (typeof INVOICE_EMAIL_DELIVERY_STATUSES)[number]

export const INVOICE_EMAIL_DELIVERY_SOURCES = ['manual', 'automatic'] as const

export type InvoiceEmailDeliverySource =
  (typeof INVOICE_EMAIL_DELIVERY_SOURCES)[number]

export const ACTIVE_INVOICE_EMAIL_DELIVERY_STATUSES = [
  'queued',
  'processing',
  'accepted',
] as const satisfies readonly InvoiceEmailDeliveryStatus[]

const activeStatuses = new Set<InvoiceEmailDeliveryStatus>(
  ACTIVE_INVOICE_EMAIL_DELIVERY_STATUSES,
)

export function isActiveInvoiceEmailDeliveryStatus(
  status: InvoiceEmailDeliveryStatus,
): boolean {
  return activeStatuses.has(status)
}

export const INVOICE_EMAIL_DELIVERY_STATUS_LABELS: Record<
  InvoiceEmailDeliveryStatus,
  string
> = {
  queued: 'Đang chờ',
  processing: 'Đang gửi',
  accepted: 'Đã tiếp nhận',
  delivered: 'Đã giao',
  failed: 'Thất bại',
  bounced: 'Bị trả lại',
  complained: 'Bị báo spam',
  skipped: 'Đã bỏ qua',
}

export const INVOICE_EMAIL_DELIVERY_STATUS_VARIANTS = {
  queued: 'accent',
  processing: 'accent',
  accepted: 'accent',
  delivered: 'success',
  failed: 'danger',
  bounced: 'danger',
  complained: 'danger',
  skipped: 'warning',
} as const
