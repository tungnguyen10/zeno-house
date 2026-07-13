import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { buildInvoice, buildInvoicePayment } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const rpcMock = vi.fn()
const enrichPayments = vi.fn(async payments => payments)
const findManyInvoices = vi.fn()
const findManyPeriods = vi.fn()

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
  serverSupabaseServiceRole: vi.fn(() => ({
    rpc: rpcMock,
  })),
}))

vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return { enrichPayments }
  }),
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    findManyByIdentifiers: findManyInvoices,
  },
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findManyByIds: findManyPeriods,
  },
}))

function user(): AuthUser {
  return { id: 'user-1', app_metadata: { role: 'admin' } } as AuthUser
}

function event() {
  return { context: {} } as never
}

/**
 * Tests for `InvoicePaymentService.recordBatch` after the RPC hardening
 * (`billing-transaction-hardening`). The whole write is delegated to the
 * `public.record_bulk_payments` PL/pgSQL function so we mock the rpc client
 * and assert: payload shape, payment row mapping, and CONFLICT-envelope
 * mapping for structured exceptions.
 */
describe('InvoicePaymentService.recordBatch (RPC-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyInvoices.mockImplementation(async (_event, ids: string[]) =>
      ids.map(id => buildInvoice({ id, invoiceCode: id, billingPeriodId: `period-${id}` })),
    )
    findManyPeriods.mockImplementation(async (_event, ids: string[]) =>
      ids.map(id => buildPeriod({ id, buildingId: 'building-1' })),
    )
  })

  function rowFromPayment(p: ReturnType<typeof buildInvoicePayment>) {
    return {
      id: p.id,
      invoice_id: p.invoiceId,
      amount: p.amount,
      paid_at: p.paidAt,
      payment_method: p.paymentMethod,
      note: p.note,
      recorded_by: p.recordedBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    }
  }

  it('forwards items to record_bulk_payments and maps the returned payment rows', async () => {
    const inserted = [
      buildInvoicePayment({ id: 'payment-1', invoiceId: 'invoice-1', amount: 1_000_000 }),
      buildInvoicePayment({ id: 'payment-2', invoiceId: 'invoice-2', amount: 2_000_000 }),
    ]
    rpcMock.mockResolvedValueOnce({ data: inserted.map(rowFromPayment), error: null })

    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')

    const result = await InvoicePaymentService.recordBatch(
      event(),
      user(),
      {
        payments: [
          { invoice_id: 'invoice-1', amount: 1_000_000, payment_date: '2026-06-02', payment_method: 'cash' },
          { invoice_id: 'invoice-2', amount: 2_000_000, payment_date: '2026-06-02', payment_method: 'transfer' },
        ],
      },
    )

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [fnName, args] = rpcMock.mock.calls[0]!
    expect(fnName).toBe('record_bulk_payments')
    expect(args).toMatchObject({
      p_actor_id: 'user-1',
      p_payments: [
        { invoice_id: 'invoice-1', amount: 1_000_000, payment_date: '2026-06-02', payment_method: 'cash' },
        { invoice_id: 'invoice-2', amount: 2_000_000, payment_date: '2026-06-02', payment_method: 'transfer' },
      ],
    })

    expect(result.count).toBe(2)
    expect(result.totalAmount).toBe(3_000_000)
    expect(result.invoiceIds.sort()).toEqual(['invoice-1', 'invoice-2'])
    expect(enrichPayments).toHaveBeenCalledTimes(1)
  })

  it('preserves the CONFLICT envelope with failed_index / failed_reason from the RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        message: 'amount 9999999 exceeds balance 500000',
        details: JSON.stringify({
          failed_index: 1,
          failed_reason: 'Số tiền vượt quá công nợ còn lại của hoá đơn',
        }),
      },
    })

    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')

    await expect(
      InvoicePaymentService.recordBatch(
        event(),
        user(),
        {
          payments: [
            { invoice_id: 'invoice-1', amount: 1_000, payment_date: '2026-06-02' },
            { invoice_id: 'invoice-2', amount: 9_999_999, payment_date: '2026-06-02' },
          ],
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      data: {
        error: {
          code: 'CONFLICT',
          message: expect.stringContaining('Lỗi tại dòng 2'),
          details: {
            failed_index: 1,
            failed_reason: 'Số tiền vượt quá công nợ còn lại của hoá đơn',
          },
        },
      },
    })

    expect(enrichPayments).not.toHaveBeenCalled()
  })

  it('falls back to error.message when the RPC error has no structured details', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX000', message: 'unexpected db failure', details: null },
    })

    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')

    await expect(
      InvoicePaymentService.recordBatch(
        event(),
        user(),
        {
          payments: [
            { invoice_id: 'invoice-1', amount: 1_000, payment_date: '2026-06-02' },
          ],
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      data: {
        error: {
          code: 'CONFLICT',
          message: expect.stringContaining('unexpected db failure'),
          details: { failed_index: 0, failed_reason: 'unexpected db failure' },
        },
      },
    })
  })

  it('rejects an empty payments array before calling the RPC', async () => {
    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')

    await expect(
      InvoicePaymentService.recordBatch(
        event(),
        user(),
        { payments: [] },
      ),
    ).rejects.toMatchObject({ statusCode: 422 })

    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('passes a multi-period batch through unchanged (RPC owns period transitions)', async () => {
    const inserted = [
      buildInvoicePayment({ id: 'payment-A', invoiceId: 'invoice-A', amount: 500_000 }),
      buildInvoicePayment({ id: 'payment-B', invoiceId: 'invoice-B', amount: 700_000 }),
    ]
    rpcMock.mockResolvedValueOnce({ data: inserted.map(rowFromPayment), error: null })

    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')

    const result = await InvoicePaymentService.recordBatch(
      event(),
      user(),
      {
        payments: [
          { invoice_id: 'invoice-A', amount: 500_000, payment_date: '2026-06-02' },
          { invoice_id: 'invoice-B', amount: 700_000, payment_date: '2026-06-02' },
        ],
      },
    )

    // Service is now period-agnostic: it just forwards items. Period
    // transitions and audit fan-out happen in PL/pgSQL.
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(result.invoiceIds).toEqual(['invoice-A', 'invoice-B'])
    expect(result.totalAmount).toBe(1_200_000)
  })
})
