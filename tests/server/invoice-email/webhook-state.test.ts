import { describe, expect, it } from 'vitest'
import type { InternalInvoiceEmailDeliveryRow } from '../../../server/repositories/invoice-email-deliveries'
import { webhookStatePatch } from '../../../server/services/invoice-email/webhook'

function row(
  overrides: Partial<InternalInvoiceEmailDeliveryRow> = {},
): InternalInvoiceEmailDeliveryRow {
  return {
    id: 'delivery-1',
    invoice_id: 'invoice-1',
    building_id: 'building-1',
    billing_period_id: 'period-1',
    recipient_email: 'tenant@example.test',
    source: 'manual',
    status: 'accepted',
    provider_email_id: 'email-1',
    idempotency_key: 'delivery-1',
    attempt_count: 1,
    next_attempt_at: null,
    lease_expires_at: null,
    last_error_code: null,
    last_error_message: null,
    accepted_at: '2026-07-23T01:00:00.000Z',
    delivered_at: null,
    failed_at: null,
    bounced_at: null,
    complained_at: null,
    skipped_at: null,
    provider_event_at: '2026-07-23T01:00:00.000Z',
    created_by: 'user-1',
    created_at: '2026-07-23T00:59:00.000Z',
    updated_at: '2026-07-23T01:00:00.000Z',
    skip_reason: null,
    locked_by: null,
    ...overrides,
  }
}

describe('invoice email webhook state ordering', () => {
  it('advances accepted deliveries to delivered', () => {
    expect(webhookStatePatch(
      row(),
      'email.delivered',
      '2026-07-23T01:02:00.000Z',
    )).toMatchObject({
      status: 'delivered',
      delivered_at: '2026-07-23T01:02:00.000Z',
    })
  })

  it('does not regress delivered from a sent event', () => {
    expect(webhookStatePatch(
      row({ status: 'delivered', delivered_at: '2026-07-23T01:02:00.000Z' }),
      'email.sent',
      '2026-07-23T01:03:00.000Z',
    )).toBeNull()
  })

  it('ignores older events and permits newer bounce/complaint terminal outcomes', () => {
    expect(webhookStatePatch(
      row({ status: 'delivered', provider_event_at: '2026-07-23T01:04:00.000Z' }),
      'email.failed',
      '2026-07-23T01:03:00.000Z',
    )).toBeNull()

    expect(webhookStatePatch(
      row({ status: 'delivered', provider_event_at: '2026-07-23T01:04:00.000Z' }),
      'email.bounced',
      '2026-07-23T01:05:00.000Z',
    )).toMatchObject({
      status: 'bounced',
      bounced_at: '2026-07-23T01:05:00.000Z',
      failed_at: '2026-07-23T01:05:00.000Z',
    })
  })

  it('uses terminal precedence for events with the same provider timestamp', () => {
    expect(webhookStatePatch(
      row({ status: 'bounced', provider_event_at: '2026-07-23T01:05:00.000Z' }),
      'email.complained',
      '2026-07-23T01:05:00.000Z',
    )).toMatchObject({ status: 'complained' })

    expect(webhookStatePatch(
      row({ status: 'complained', provider_event_at: '2026-07-23T01:05:00.000Z' }),
      'email.bounced',
      '2026-07-23T01:05:00.000Z',
    )).toBeNull()
  })

  it('never regresses bounce or complaint from a later lower-precedence event', () => {
    expect(webhookStatePatch(
      row({ status: 'bounced', provider_event_at: '2026-07-23T01:05:00.000Z' }),
      'email.failed',
      '2026-07-23T01:06:00.000Z',
    )).toBeNull()

    expect(webhookStatePatch(
      row({ status: 'complained', provider_event_at: '2026-07-23T01:05:00.000Z' }),
      'email.bounced',
      '2026-07-23T01:06:00.000Z',
    )).toBeNull()
  })
})
