import { describe, expect, it } from 'vitest'
import {
  INVOICE_EMAIL_DELIVERY_SOURCES,
  INVOICE_EMAIL_DELIVERY_STATUSES,
  isActiveInvoiceEmailDeliveryStatus,
} from '../../app/utils/constants/invoice-email'
import {
  invoiceEmailEnqueueSchema,
  invoiceEmailSettingsUpdateSchema,
} from '../../app/utils/validators/invoice-email'
import {
  mapBuildingInvoiceEmailSettings,
  mapInvoiceEmailDelivery,
} from '../../app/utils/mappers/invoice-email'

describe('invoice email contracts', () => {
  it('defines the complete delivery state machine and active states', () => {
    expect(INVOICE_EMAIL_DELIVERY_STATUSES).toEqual([
      'queued',
      'processing',
      'accepted',
      'delivered',
      'failed',
      'bounced',
      'complained',
      'skipped',
    ])
    expect(INVOICE_EMAIL_DELIVERY_SOURCES).toEqual(['manual', 'automatic'])
    expect(isActiveInvoiceEmailDeliveryStatus('queued')).toBe(true)
    expect(isActiveInvoiceEmailDeliveryStatus('processing')).toBe(true)
    expect(isActiveInvoiceEmailDeliveryStatus('accepted')).toBe(true)
    expect(isActiveInvoiceEmailDeliveryStatus('delivered')).toBe(false)
  })

  it('accepts one to 100 UUIDs or invoice codes and rejects empty identifiers', () => {
    expect(invoiceEmailEnqueueSchema.parse({
      invoice_ids: ['00000000-0000-4000-8000-000000000001', 'inv-2026-07-0001'],
    })).toEqual({
      invoice_ids: ['00000000-0000-4000-8000-000000000001', 'inv-2026-07-0001'],
    })

    expect(() => invoiceEmailEnqueueSchema.parse({ invoice_ids: [] })).toThrow()
    expect(() => invoiceEmailEnqueueSchema.parse({ invoice_ids: [''] })).toThrow()
    expect(() => invoiceEmailEnqueueSchema.parse({
      invoice_ids: Array.from({ length: 101 }, (_, index) => `inv-${index}`),
    })).toThrow()
  })

  it('accepts only an explicit boolean building setting', () => {
    expect(invoiceEmailSettingsUpdateSchema.parse({ auto_send_enabled: true }))
      .toEqual({ auto_send_enabled: true })
    expect(() => invoiceEmailSettingsUpdateSchema.parse({ auto_send_enabled: 'true' })).toThrow()
  })

  it('maps database rows without exposing internal lease or idempotency fields', () => {
    const delivery = mapInvoiceEmailDelivery({
      id: 'delivery-1',
      invoice_id: 'invoice-1',
      building_id: 'building-1',
      billing_period_id: 'period-1',
      recipient_email: 'tenant@example.test',
      source: 'manual',
      status: 'accepted',
      provider_email_id: 'resend-1',
      idempotency_key: 'secret-idempotency-key',
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
      provider_event_at: null,
      created_by: 'user-1',
      created_at: '2026-07-23T00:59:00.000Z',
      updated_at: '2026-07-23T01:00:00.000Z',
    })

    expect(delivery).toMatchObject({
      id: 'delivery-1',
      invoiceId: 'invoice-1',
      recipientEmail: 'tenant@example.test',
      source: 'manual',
      status: 'accepted',
      providerEmailId: 'resend-1',
      attemptCount: 1,
    })
    expect(delivery).not.toHaveProperty('idempotencyKey')
    expect(delivery).not.toHaveProperty('leaseExpiresAt')
  })

  it('maps absent building settings to a default-off DTO', () => {
    expect(mapBuildingInvoiceEmailSettings('building-1', null, true)).toEqual({
      buildingId: 'building-1',
      autoSendEnabled: false,
      featureAvailable: true,
      createdAt: null,
      updatedAt: null,
      updatedBy: null,
    })
  })
})
