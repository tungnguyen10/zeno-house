import { INVOICE_STATUSES, UNKNOWN_STATUS, type StatusVariant } from '~/utils/constants/statuses'
import type { InvoiceStatus } from '~/utils/constants/billing'
import type { InvoiceDocumentImageAsset } from '../../types/invoice-email'

/**
 * Light-theme swatches for invoice documents (email + PDF render on white).
 * Mirrors the semantic intent of `UiBadge` variants without importing its
 * dark-surface Tailwind tokens, which are meaningless off-app.
 */
export interface StatusSwatch {
  label: string
  background: string
  foreground: string
  border: string
}

const VARIANT_SWATCHES: Record<StatusVariant, Omit<StatusSwatch, 'label'>> = {
  success: { background: '#ecfdf5', foreground: '#059669', border: '#a7f3d0' },
  danger: { background: '#fef2f2', foreground: '#dc2626', border: '#fecaca' },
  warning: { background: '#fffbeb', foreground: '#b45309', border: '#fde68a' },
  accent: { background: '#ecfeff', foreground: '#0891b2', border: '#a5f3fc' },
  neutral: { background: '#f1f5f9', foreground: '#475569', border: '#e2e8f0' },
}

/** Resolve an invoice status to its label + light-theme colours. */
export function invoiceStatusSwatch(status: InvoiceStatus): StatusSwatch {
  const def = INVOICE_STATUSES[status] ?? UNKNOWN_STATUS
  return { label: def.label, ...VARIANT_SWATCHES[def.variant] }
}

/**
 * Build an inline `data:` URI so email clients render logo/QR without relying
 * on CID inline attachments (which several clients silently drop).
 */
export function imageDataUri(asset: InvoiceDocumentImageAsset): string {
  return `data:${asset.contentType};base64,${asset.data.toString('base64')}`
}
