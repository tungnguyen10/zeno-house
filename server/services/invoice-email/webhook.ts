import type { H3Event } from 'h3'
import type { InvoiceEmailDeliveryStatus } from '~/utils/constants/invoice-email'
import type { InternalInvoiceEmailDeliveryRow } from '../../repositories/invoice-email-deliveries'
import { InvoiceEmailDeliveryRepository } from '../../repositories/invoice-email-deliveries'

export type SupportedResendInvoiceEvent =
  | 'email.sent'
  | 'email.delivered'
  | 'email.failed'
  | 'email.bounced'
  | 'email.complained'

const STATUS_PRECEDENCE: Record<InvoiceEmailDeliveryStatus, number> = {
  queued: 0,
  processing: 1,
  accepted: 2,
  delivered: 3,
  failed: 4,
  bounced: 5,
  complained: 6,
  skipped: 7,
}

function targetStatus(type: SupportedResendInvoiceEvent): InvoiceEmailDeliveryStatus {
  switch (type) {
    case 'email.sent': return 'accepted'
    case 'email.delivered': return 'delivered'
    case 'email.failed': return 'failed'
    case 'email.bounced': return 'bounced'
    case 'email.complained': return 'complained'
  }
}

export function webhookStatePatch(
  row: InternalInvoiceEmailDeliveryRow,
  type: SupportedResendInvoiceEvent,
  eventCreatedAt: string,
): Partial<InternalInvoiceEmailDeliveryRow> | null {
  const incomingTime = Date.parse(eventCreatedAt)
  const storedTime = row.provider_event_at ? Date.parse(row.provider_event_at) : Number.NEGATIVE_INFINITY
  const incomingStatus = targetStatus(type)
  const currentStatus = row.status as InvoiceEmailDeliveryStatus

  if (incomingTime < storedTime) return null
  if (
    incomingTime === storedTime
    && STATUS_PRECEDENCE[incomingStatus] <= STATUS_PRECEDENCE[currentStatus]
  ) return null
  if (
    type === 'email.sent'
    && STATUS_PRECEDENCE[currentStatus] > STATUS_PRECEDENCE.accepted
  ) return null
  if (
    type === 'email.delivered'
    && STATUS_PRECEDENCE[currentStatus] > STATUS_PRECEDENCE.delivered
  ) return null
  if (
    (currentStatus === 'bounced' || currentStatus === 'complained')
    && STATUS_PRECEDENCE[incomingStatus] <= STATUS_PRECEDENCE[currentStatus]
  ) return null

  const patch: Partial<InternalInvoiceEmailDeliveryRow> = {
    status: incomingStatus,
    provider_event_at: eventCreatedAt,
  }
  if (type === 'email.sent' && !row.accepted_at) patch.accepted_at = eventCreatedAt
  if (type === 'email.delivered') patch.delivered_at = eventCreatedAt
  if (type === 'email.failed') patch.failed_at = eventCreatedAt
  if (type === 'email.bounced') {
    patch.bounced_at = eventCreatedAt
    patch.failed_at = eventCreatedAt
  }
  if (type === 'email.complained') {
    patch.complained_at = eventCreatedAt
    patch.failed_at = eventCreatedAt
  }
  return patch
}

export const InvoiceEmailWebhookService = {
  async handle(
    event: H3Event,
    input: {
      svixId: string
      providerEmailId: string
      type: SupportedResendInvoiceEvent
      eventCreatedAt: string
    },
  ): Promise<{ duplicate: boolean; matched: boolean; updated: boolean }> {
    return InvoiceEmailDeliveryRepository.applyWebhookEvent(event, {
      svixId: input.svixId,
      providerEmailId: input.providerEmailId,
      eventType: input.type,
      eventCreatedAt: input.eventCreatedAt,
    })
  },
}
