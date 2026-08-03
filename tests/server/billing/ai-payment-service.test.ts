import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findPeriod = vi.fn()
const recordAiBatchWithAudit = vi.fn()
const assertScope = vi.fn()
const enrichPayments = vi.fn(async value => value)
const enrichInvoices = vi.fn(async value => value)

vi.mock('../../../server/repositories/billing/periods', () => ({ BillingPeriodRepository: { findById: findPeriod } }))
vi.mock('../../../server/repositories/billing/payments', () => ({
  InvoicePaymentRepository: { recordAiBatchWithAudit },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: assertScope }))
vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: class {
    enrichPayments = enrichPayments
    enrichInvoices = enrichInvoices
  },
}))
vi.mock('../../../server/services/operations-report/cache', () => ({ invalidateOperationsReport: vi.fn() }))

const period = buildPeriod({
  id: '00000000-0000-4000-8000-000000000011',
  buildingId: '00000000-0000-4000-8000-000000000010', status: 'issued',
})
const invoice = buildInvoice({
  id: '00000000-0000-4000-8000-000000000031', billingPeriodId: period.id,
  roomId: '00000000-0000-4000-8000-000000000021', status: 'issued', balanceAmount: 1_000_000,
})
const input = {
  periodId: period.id,
  payments: [{
    invoiceId: invoice.id, roomId: invoice.roomId,
    expectedUpdatedAt: invoice.updatedAt, expectedBalanceAmount: invoice.balanceAmount,
  }],
  paymentDate: '2026-07-05', paymentMethod: 'cash', note: null,
  correlationId: '00000000-0000-4000-8000-000000000099',
}

describe('InvoicePaymentService AI batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', (user: { app_metadata?: { role?: string } }) => ['admin', 'owner', 'manager'].includes(user.app_metadata?.role ?? ''))
    findPeriod.mockResolvedValue(period)
    recordAiBatchWithAudit.mockResolvedValue({
      count: 1, totalAmount: 1_000_000, invoiceIds: [invoice.id], payments: [], invoices: [invoice], replayed: false,
    })
  })

  it.each(['admin', 'owner', 'manager'])('enforces scope then records for %s with billing.write', async (role) => {
    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')
    await InvoicePaymentService.recordAiBatch({} as never, { id: 'user-1', app_metadata: { role } } as never, input)
    expect(assertScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), period.buildingId, 'write')
    expect(recordAiBatchWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: 'user-1' }))
  })

  it.each(['tenant', null])('denies role %s before repository mutation', async (role) => {
    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')
    await expect(InvoicePaymentService.recordAiBatch(
      {} as never, { id: 'user-1', app_metadata: { role } } as never, input,
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(recordAiBatchWithAudit).not.toHaveBeenCalled()
  })

  it('preserves domain replay metadata returned by the atomic RPC', async () => {
    const { InvoicePaymentService } = await import('../../../server/services/billing/payments')
    recordAiBatchWithAudit.mockResolvedValueOnce({
      count: 1, totalAmount: 1_000_000, invoiceIds: [invoice.id], payments: [], invoices: [invoice], replayed: true,
    })
    await expect(InvoicePaymentService.recordAiBatch(
      {} as never, { id: 'user-1', app_metadata: { role: 'admin' } } as never, input,
    )).resolves.toMatchObject({ replayed: true })
  })
})
