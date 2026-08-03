import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'
import { hashInvoicePaymentSnapshot } from '../../../server/services/ai/invoice-payment-snapshot'

const findPeriod = vi.fn()
const findInvoices = vi.fn()
const recordAiBatch = vi.fn()

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findById: findPeriod },
}))
vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: { findManyByIdentifiers: findInvoices },
}))
vi.mock('../../../server/services/billing/payments', () => ({
  InvoicePaymentService: { recordAiBatch },
}))

const period = buildPeriod({
  id: '00000000-0000-4000-8000-000000000011',
  buildingId: '00000000-0000-4000-8000-000000000010', status: 'issued',
  updatedAt: '2026-07-02T00:00:00.000Z',
})
const invoice = buildInvoice({
  id: '00000000-0000-4000-8000-000000000031', billingPeriodId: period.id,
  roomId: '00000000-0000-4000-8000-000000000021', status: 'issued',
  balanceAmount: 1_000_000, paidAmount: 0, updatedAt: '2026-07-03T00:00:00.000Z',
})

function context(overrides: Record<string, unknown> = {}) {
  const snapshotHash = hashInvoicePaymentSnapshot(period, [invoice])
  return {
    event: {}, user: { id: 'user-1', app_metadata: { role: 'admin' } }, idempotencyKey: 'operation-1',
    plan: {
      id: 'plan-1', conversationId: 'conversation-1', resourceVersions: { payment_snapshot: snapshotHash },
      normalizedPayload: {
        billing_period_id: period.id,
        payments: [{ invoice_id: invoice.id, room_id: invoice.roomId, expected_updated_at: invoice.updatedAt, expected_balance_amount: invoice.balanceAmount }],
        payment_date: '2026-07-05', payment_method: 'cash', note: null, snapshot_hash: snapshotHash,
        ...overrides,
      },
    },
  } as never
}

describe('AI invoice payment executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findPeriod.mockResolvedValue(period)
    findInvoices.mockResolvedValue([invoice])
    recordAiBatch.mockResolvedValue({ count: 1, totalAmount: 1_000_000, replayed: false })
  })

  it('revalidates the canonical period and invoice snapshot before executing', async () => {
    const { RECORD_INVOICE_PAYMENTS_EXECUTOR } = await import('../../../server/services/ai/invoice-payment-executor')
    const ctx = context()
    await RECORD_INVOICE_PAYMENTS_EXECUTOR.revalidate?.(ctx)
    await expect(RECORD_INVOICE_PAYMENTS_EXECUTOR.execute(ctx)).resolves.toMatchObject({ count: 1 })
    expect(recordAiBatch).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      periodId: period.id,
      paymentDate: '2026-07-05',
      paymentMethod: 'cash',
      correlationId: 'operation-1',
      payments: [{
        invoiceId: invoice.id, roomId: invoice.roomId,
        expectedUpdatedAt: invoice.updatedAt, expectedBalanceAmount: 1_000_000,
      }],
    }))
  })

  it.each([
    ['version', { ...invoice, updatedAt: '2026-07-04T00:00:00.000Z' }],
    ['balance', { ...invoice, balanceAmount: 900_000 }],
    ['status', { ...invoice, status: 'paid' as const, balanceAmount: 0 }],
    ['void', { ...invoice, status: 'void' as const, voidedAt: '2026-07-04T00:00:00.000Z' }],
  ])('marks the complete action stale when invoice %s changes', async (_name, current) => {
    findInvoices.mockResolvedValue([current])
    const { RECORD_INVOICE_PAYMENTS_EXECUTOR } = await import('../../../server/services/ai/invoice-payment-executor')
    await expect(RECORD_INVOICE_PAYMENTS_EXECUTOR.revalidate?.(context())).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'OPTIMISTIC_LOCK_CONFLICT' } } },
    })
    expect(recordAiBatch).not.toHaveBeenCalled()
  })

  it('becomes stale when the period closes or an invoice disappears', async () => {
    const { RECORD_INVOICE_PAYMENTS_EXECUTOR } = await import('../../../server/services/ai/invoice-payment-executor')
    findPeriod.mockResolvedValueOnce({ ...period, status: 'closed' })
    await expect(RECORD_INVOICE_PAYMENTS_EXECUTOR.revalidate?.(context())).rejects.toMatchObject({ statusCode: 409 })
    findPeriod.mockResolvedValue(period)
    findInvoices.mockResolvedValue([])
    await expect(RECORD_INVOICE_PAYMENTS_EXECUTOR.revalidate?.(context())).rejects.toMatchObject({ statusCode: 409 })
  })
})
