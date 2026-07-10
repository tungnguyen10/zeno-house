import type { BillingAuditEvent } from '~/types/billing'

export interface DiffView {
  label: string
  before: string | number | null
  after: string | number | null
  delta?: string | number | null
}

/** Format an ISO timestamp for display in Vietnamese locale. */
export function formatAuditTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour12: false })
  }
  catch {
    return iso
  }
}

/** Resolve a display name for the actor of an audit event. */
export function auditActorLabel(ev: BillingAuditEvent): string {
  return ev.actorName ?? ev.actorEmail ?? (ev.actorId ? 'Người dùng' : 'Hệ thống')
}

/** True when the event carries before/after/metadata data worth expanding. */
export function hasAuditTechnicalDetail(ev: BillingAuditEvent): boolean {
  return !!(ev.beforeData || ev.afterData || Object.keys(ev.metadata ?? {}).length > 0)
}

/** Serialize the technical detail (before/after/metadata) of an event to JSON. */
export function auditTechnicalJson(ev: BillingAuditEvent): string {
  const detail: Record<string, unknown> = {}
  if (ev.beforeData !== null && ev.beforeData !== undefined) detail.before = ev.beforeData
  if (ev.afterData !== null && ev.afterData !== undefined) detail.after = ev.afterData
  if (Object.keys(ev.metadata ?? {}).length > 0) detail.metadata = ev.metadata
  return JSON.stringify(detail, null, 2)
}

/** Format a diff value for display; null/undefined renders as '—'. */
export function formatDiffVal(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return v.toLocaleString('vi-VN')
  return String(v)
}

/**
 * Extract a before→after diff view from an audit event for known action types.
 * Returns null when the action has no structured diff to display.
 */
export function buildAuditDiff(ev: BillingAuditEvent): DiffView | null {
  const { action, metadata, beforeData, afterData } = ev
  const before = beforeData as Record<string, unknown> | null
  const after = afterData as Record<string, unknown> | null
  const meta = metadata as Record<string, unknown>

  if (action === 'reading.saved') {
    const prev = meta?.previous_value ?? before?.value_kwh ?? null
    const next = meta?.new_value ?? after?.value_kwh ?? null
    const delta = (typeof next === 'number' && typeof prev === 'number') ? next - prev : null
    return { label: 'Chỉ số', before: prev as number | null, after: next as number | null, delta }
  }

  if (action === 'payment.undone') {
    const amount = meta?.amount ?? (before as Record<string, unknown> | null)?.amount ?? null
    return { label: 'Thanh toán', before: amount as number | null, after: 0 }
  }

  if (action === 'utility_override.saved') {
    const prev = before?.total_amount ?? null
    const next = after?.total_amount ?? null
    return { label: 'Chi phí dịch vụ', before: prev as number | null, after: next as number | null }
  }

  return null
}
