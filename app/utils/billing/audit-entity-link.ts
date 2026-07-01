import type { BillingAuditEvent } from '~/types/billing'

/**
 * Resolve a navigable route for an audit event's entity. Prefers the
 * server-enriched `entityHref` when present; otherwise derives a best-effort
 * link from the entity type + id so the drawer can offer a "→ Mở" quick action.
 */
export function auditEntityLink(event: BillingAuditEvent): string | null {
  if (event.entityHref) return event.entityHref
  if (!event.entityId) return null

  switch (event.entityType) {
    case 'invoice':
      return `/billing/invoices/${event.entityId}`
    default:
      return null
  }
}
