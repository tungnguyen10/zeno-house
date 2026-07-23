import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InternalInvoiceEmailDeliveryRow } from '../../../server/repositories/invoice-email-deliveries'

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  markAccepted: vi.fn(),
  markRetry: vi.fn(),
  markFailed: vi.fn(),
  build: vi.fn(),
  loadAssets: vi.fn(),
  renderPdf: vi.fn(),
  renderHtml: vi.fn(),
  subject: vi.fn(),
  filename: vi.fn(),
  send: vi.fn(),
}))

vi.mock('../../../server/repositories/invoice-email-deliveries', () => ({
  InvoiceEmailDeliveryRepository: {
    claim: mocks.claim,
    markAccepted: mocks.markAccepted,
    markRetry: mocks.markRetry,
    markFailed: mocks.markFailed,
  },
}))
vi.mock('../../../server/services/invoice-email/document', () => ({
  InvoiceEmailDocumentService: { build: mocks.build },
}))
vi.mock('../../../server/services/invoice-email/assets', () => ({
  InvoiceEmailAssetService: { load: mocks.loadAssets },
}))
vi.mock('../../../server/services/invoice-email/pdf', () => ({
  renderInvoicePdf: mocks.renderPdf,
  invoicePdfFilename: mocks.filename,
}))
vi.mock('../../../server/services/invoice-email/html', () => ({
  renderInvoiceEmailHtml: mocks.renderHtml,
  invoiceEmailSubject: mocks.subject,
}))
vi.mock('../../../server/services/invoice-email/resend', () => ({
  ResendInvoiceAdapter: { send: mocks.send },
}))

function delivery(attemptCount = 1, id = 'delivery-1'): InternalInvoiceEmailDeliveryRow {
  return {
    id,
    invoice_id: `invoice-${id}`,
    building_id: 'building-1',
    billing_period_id: 'period-1',
    recipient_email: 'tenant@example.test',
    source: 'manual',
    status: 'processing',
    provider_email_id: null,
    idempotency_key: id,
    attempt_count: attemptCount,
    next_attempt_at: null,
    lease_expires_at: '2026-07-23T02:00:00.000Z',
    last_error_code: null,
    last_error_message: null,
    accepted_at: null,
    delivered_at: null,
    failed_at: null,
    bounced_at: null,
    complained_at: null,
    skipped_at: null,
    provider_event_at: null,
    created_by: 'user-1',
    created_at: '2026-07-23T01:00:00.000Z',
    updated_at: '2026-07-23T01:00:00.000Z',
    skip_reason: null,
    locked_by: 'worker',
  }
}

describe('InvoiceEmailDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useRuntimeConfig', () => ({
      resendApiKey: 're_test',
      resendFrom: 'Zeno House <billing@example.test>',
      resendReplyTo: '',
      public: { invoiceEmailEnabled: true },
    }))
    mocks.claim.mockResolvedValue([])
    mocks.build.mockResolvedValue({ invoiceCode: 'INV-1' })
    mocks.loadAssets.mockResolvedValue({ font: Buffer.from('font'), qrImage: null, logoImage: null })
    mocks.renderPdf.mockResolvedValue(Buffer.from('%PDF-test'))
    mocks.renderHtml.mockReturnValue('<p>invoice</p>')
    mocks.subject.mockReturnValue('Invoice')
    mocks.filename.mockReturnValue('hoa-don-inv-1.pdf')
    mocks.send.mockResolvedValue({ ok: true, providerEmailId: 'resend-1' })
  })

  it('preserves queued work when the global feature is disabled', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      resendApiKey: 're_test',
      resendFrom: 'billing@example.test',
      public: { invoiceEmailEnabled: false },
    }))
    const { InvoiceEmailDispatcher } = await import(
      '../../../server/services/invoice-email/dispatcher'
    )

    await expect(InvoiceEmailDispatcher.run({ context: {} } as never))
      .resolves.toMatchObject({ skipped: true, reason: 'feature_disabled', claimed: 0 })
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('sends with the delivery UUID as stable idempotency key and records acceptance', async () => {
    mocks.claim.mockResolvedValue([delivery()])
    const { InvoiceEmailDispatcher } = await import(
      '../../../server/services/invoice-email/dispatcher'
    )

    const result = await InvoiceEmailDispatcher.run({ context: {} } as never)

    expect(result).toMatchObject({ claimed: 1, accepted: 1, retried: 0, failed: 0 })
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      recipient: 'tenant@example.test',
      idempotencyKey: 'delivery-1',
      filename: 'hoa-don-inv-1.pdf',
    }))
    expect(mocks.markAccepted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'delivery-1', providerEmailId: 'resend-1' }),
    )
  })

  it('requeues retryable provider errors with the documented first delay', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T01:00:00.000Z'))
    mocks.claim.mockResolvedValue([delivery(1)])
    mocks.send.mockResolvedValue({
      ok: false,
      retryable: true,
      code: 'rate_limit_exceeded',
      message: 'Nhà cung cấp email tạm thời không khả dụng',
    })
    const { InvoiceEmailDispatcher } = await import(
      '../../../server/services/invoice-email/dispatcher'
    )

    await expect(InvoiceEmailDispatcher.run({ context: {} } as never))
      .resolves.toMatchObject({ retried: 1 })
    expect(mocks.markRetry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ nextAttemptAt: '2026-07-23T01:01:00.000Z' }),
    )
    vi.useRealTimers()
  })

  it('keeps the lease for idempotent recovery when acceptance persistence fails', async () => {
    mocks.claim.mockResolvedValue([delivery()])
    mocks.markAccepted.mockRejectedValueOnce(new Error('database unavailable'))
    const { InvoiceEmailDispatcher } = await import(
      '../../../server/services/invoice-email/dispatcher'
    )

    await expect(InvoiceEmailDispatcher.run({ context: {} } as never))
      .rejects.toThrow('database unavailable')

    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'delivery-1',
    }))
    expect(mocks.markRetry).not.toHaveBeenCalled()
    expect(mocks.markFailed).not.toHaveBeenCalled()
  })

  it('stops after six provider calls and never exceeds concurrency three', async () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      delivery(index === 0 ? 6 : 1, `delivery-${index + 1}`),
    )
    mocks.claim.mockResolvedValue(rows)
    let active = 0
    let maxActive = 0
    mocks.send.mockImplementation(async (input: { idempotencyKey: string }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await Promise.resolve()
      active -= 1
      return input.idempotencyKey === 'delivery-1'
        ? {
            ok: false,
            retryable: true,
            code: 'internal_server_error',
            message: 'Nhà cung cấp email tạm thời không khả dụng',
          }
        : { ok: true, providerEmailId: `provider-${input.idempotencyKey}` }
    })
    const { InvoiceEmailDispatcher } = await import(
      '../../../server/services/invoice-email/dispatcher'
    )

    const result = await InvoiceEmailDispatcher.run({ context: {} } as never)

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(result).toMatchObject({ claimed: 7, accepted: 6, failed: 1 })
    expect(mocks.markFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'delivery-1', errorCode: 'internal_server_error' }),
    )
  })
})
