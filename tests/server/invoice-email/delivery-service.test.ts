import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../../app/types/auth'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'
import type { InternalInvoiceEmailDeliveryRow } from '../../../server/repositories/invoice-email-deliveries'

const mocks = vi.hoisted(() => ({
  findInvoices: vi.fn(),
  findInvoice: vi.fn(),
  findPeriods: vi.fn(),
  findPeriod: vi.fn(),
  enqueue: vi.fn(),
  listHistory: vi.fn(),
  assertBuildingScope: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    findManyByIdentifiers: mocks.findInvoices,
    findByIdentifier: mocks.findInvoice,
  },
}))
vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findManyByIds: mocks.findPeriods,
    findById: mocks.findPeriod,
  },
}))
vi.mock('../../../server/repositories/invoice-email-deliveries', () => ({
  InvoiceEmailDeliveryRepository: {
    enqueue: mocks.enqueue,
    listByInvoiceId: mocks.listHistory,
  },
}))
vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope: mocks.assertBuildingScope,
}))

const user = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser

function delivery(
  overrides: Partial<InternalInvoiceEmailDeliveryRow> = {},
): InternalInvoiceEmailDeliveryRow {
  return {
    id: 'delivery-1',
    invoice_id: 'invoice-1',
    building_id: 'building-1',
    billing_period_id: 'period-1',
    recipient_email: 'tenant@example.test',
    source: 'manual',
    status: 'queued',
    provider_email_id: null,
    idempotency_key: 'secret-idempotency-key',
    attempt_count: 0,
    next_attempt_at: '2026-07-23T01:00:00.000Z',
    lease_expires_at: null,
    last_error_code: null,
    last_error_message: null,
    accepted_at: null,
    delivered_at: null,
    failed_at: null,
    bounced_at: null,
    complained_at: null,
    skipped_at: null,
    provider_event_at: null,
    created_by: user.id,
    created_at: '2026-07-23T01:00:00.000Z',
    updated_at: '2026-07-23T01:00:00.000Z',
    skip_reason: null,
    locked_by: null,
    ...overrides,
  }
}

describe('InvoiceEmailDeliveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', () => true)
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { invoiceEmailEnabled: true },
    }))
    mocks.findPeriods.mockResolvedValue([
      buildPeriod({ id: 'period-1', buildingId: 'building-1' }),
    ])
    mocks.findPeriod.mockResolvedValue(
      buildPeriod({ id: 'period-1', buildingId: 'building-1' }),
    )
    mocks.assertBuildingScope.mockResolvedValue(undefined)
    mocks.enqueue.mockResolvedValue({ row: delivery(), reused: false })
    mocks.listHistory.mockResolvedValue([])
  })

  it('returns explicit per-item results for queued, void, and missing invoices', async () => {
    const active = buildInvoice({
      id: 'invoice-1',
      invoiceCode: 'INV-1',
      billingPeriodId: 'period-1',
      status: 'issued',
    })
    const voided = buildInvoice({
      id: 'invoice-void',
      invoiceCode: 'INV-VOID',
      billingPeriodId: 'period-1',
      status: 'void',
    })
    mocks.findInvoices.mockResolvedValue([active, voided])
    const { InvoiceEmailDeliveryService } = await import(
      '../../../server/services/invoice-email/deliveries'
    )

    const result = await InvoiceEmailDeliveryService.enqueue(
      { context: {} } as never,
      user,
      ['INV-1', 'INV-VOID', 'INV-MISSING'],
    )

    expect(result.results.map(item => item.status)).toEqual(['queued', 'failed', 'failed'])
    expect(result.results[0]?.delivery).not.toHaveProperty('idempotencyKey')
    expect(result.results[1]?.reason).toContain('không ở trạng thái')
    expect(result.results[2]?.invoiceId).toBeNull()
    expect(mocks.enqueue).toHaveBeenCalledTimes(1)
  })

  it('reports skipped recipients and reuses active work without another delivery identity', async () => {
    const active = buildInvoice({
      id: 'invoice-1',
      invoiceCode: 'INV-1',
      billingPeriodId: 'period-1',
      status: 'issued',
    })
    mocks.findInvoices.mockResolvedValue([active])
    mocks.enqueue
      .mockResolvedValueOnce({
        row: delivery({
          recipient_email: null,
          status: 'skipped',
          skip_reason: 'recipient_missing',
          skipped_at: '2026-07-23T01:00:00.000Z',
          next_attempt_at: null,
        }),
        reused: false,
      })
      .mockResolvedValueOnce({ row: delivery(), reused: true })
    const { InvoiceEmailDeliveryService } = await import(
      '../../../server/services/invoice-email/deliveries'
    )

    await expect(InvoiceEmailDeliveryService.enqueue(
      { context: {} } as never,
      user,
      ['INV-1'],
    )).resolves.toMatchObject({
      results: [{ status: 'skipped', reason: 'recipient_missing' }],
    })
    await expect(InvoiceEmailDeliveryService.enqueue(
      { context: {} } as never,
      user,
      ['INV-1'],
    )).resolves.toMatchObject({
      results: [{ status: 'already_queued' }],
    })
  })

  it('gates enqueue globally and safely masks out-of-scope bulk items', async () => {
    const active = buildInvoice({
      id: 'invoice-1',
      invoiceCode: 'INV-1',
      billingPeriodId: 'period-1',
      status: 'issued',
    })
    mocks.findInvoices.mockResolvedValue([active])
    const { InvoiceEmailDeliveryService } = await import(
      '../../../server/services/invoice-email/deliveries'
    )

    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { invoiceEmailEnabled: false },
    }))
    await expect(InvoiceEmailDeliveryService.enqueue(
      { context: {} } as never,
      user,
      ['INV-1'],
    )).rejects.toMatchObject({ statusCode: 409 })

    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { invoiceEmailEnabled: true },
    }))
    mocks.assertBuildingScope.mockRejectedValueOnce({ statusCode: 403 })
    await expect(InvoiceEmailDeliveryService.enqueue(
      { context: {} } as never,
      user,
      ['INV-1'],
    )).resolves.toMatchObject({
      results: [{ status: 'failed', reason: 'Không thể xếp hàng gửi hoá đơn này' }],
    })
  })

  it('returns newest-first repository history through a scoped safe DTO', async () => {
    const invoice = buildInvoice({
      id: 'invoice-1',
      billingPeriodId: 'period-1',
      status: 'issued',
    })
    mocks.findInvoice.mockResolvedValue(invoice)
    mocks.listHistory.mockResolvedValue([
      delivery({
        id: 'delivery-new',
        status: 'delivered',
        provider_email_id: 'provider-1',
        delivered_at: '2026-07-23T02:00:00.000Z',
        created_at: '2026-07-23T01:00:00.000Z',
      }),
    ])
    const { InvoiceEmailDeliveryService } = await import(
      '../../../server/services/invoice-email/deliveries'
    )

    const result = await InvoiceEmailDeliveryService.history(
      { context: {} } as never,
      user,
      invoice.id,
    )

    expect(mocks.assertBuildingScope).toHaveBeenCalledWith(
      expect.anything(),
      user,
      'building-1',
      'read',
    )
    expect(result[0]).toMatchObject({
      id: 'delivery-new',
      status: 'delivered',
      providerEmailId: 'provider-1',
    })
    expect(result[0]).not.toHaveProperty('idempotency_key')
    expect(result[0]).not.toHaveProperty('locked_by')
  })
})
