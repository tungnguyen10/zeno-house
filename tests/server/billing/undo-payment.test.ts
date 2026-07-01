import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { buildInvoice, buildInvoicePayment } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findInvoiceByIdentifier = vi.fn()
const updatePaymentTotals = vi.fn()
const findPaymentById = vi.fn()
const softDelete = vi.fn()
const sumByInvoice = vi.fn()
const findPeriodById = vi.fn()
const append = vi.fn()
const enrichInvoices = vi.fn(async (invoices: unknown[]) => invoices)
const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    findByIdentifier: findInvoiceByIdentifier,
    updatePaymentTotals,
  },
}))

vi.mock('../../../server/repositories/billing/payments', () => ({
  InvoicePaymentRepository: {
    findById: findPaymentById,
    softDelete,
    sumByInvoice,
  },
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findById: findPeriodById,
  },
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: {
    append,
  },
}))

vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return { enrichInvoices }
  }),
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

function makeUser(role: 'admin' | 'manager' = 'admin'): AuthUser {
  return {
    id: 'user-1',
    app_metadata: { role },
  } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('UndoPaymentService.undoPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', () => true)
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'collecting' }))
  })

  it('soft-deletes the payment and recomputes the invoice to issued when nothing remains', async () => {
    const invoice = buildInvoice({
      id: 'invoice-1',
      billingPeriodId: 'period-1',
      status: 'paid',
      totalAmount: 1_000_000,
      paidAmount: 1_000_000,
      balanceAmount: 0,
    })
    findInvoiceByIdentifier.mockResolvedValue(invoice)
    findPaymentById.mockResolvedValue(buildInvoicePayment({ id: 'payment-1', invoiceId: 'invoice-1', amount: 1_000_000 }))
    sumByInvoice.mockResolvedValue(0)
    updatePaymentTotals.mockResolvedValue(buildInvoice({
      id: 'invoice-1',
      status: 'issued',
      totalAmount: 1_000_000,
      paidAmount: 0,
      balanceAmount: 1_000_000,
    }))

    const { UndoPaymentService } = await import('../../../server/services/billing/undo-payment')

    const result = await UndoPaymentService.undoPayment(event(), makeUser(), 'invoice-1', 'payment-1', 'nhập nhầm')

    expect(softDelete).toHaveBeenCalledWith(expect.anything(), 'payment-1', 'user-1', 'nhập nhầm')
    expect(updatePaymentTotals).toHaveBeenCalledWith(
      expect.anything(),
      'invoice-1',
      0,
      1_000_000,
      'issued',
      null,
    )
    expect(append).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: 'payment.undone', entity_id: 'invoice-1' }),
    )
    expect(result.status).toBe('issued')
  })

  it('recomputes to partial when some payments remain', async () => {
    const invoice = buildInvoice({
      id: 'invoice-1',
      billingPeriodId: 'period-1',
      status: 'paid',
      totalAmount: 1_000_000,
      paidAmount: 1_000_000,
      balanceAmount: 0,
    })
    findInvoiceByIdentifier.mockResolvedValue(invoice)
    findPaymentById.mockResolvedValue(buildInvoicePayment({ id: 'payment-2', invoiceId: 'invoice-1', amount: 400_000 }))
    sumByInvoice.mockResolvedValue(600_000)
    updatePaymentTotals.mockResolvedValue(buildInvoice({ id: 'invoice-1', status: 'partial' }))

    const { UndoPaymentService } = await import('../../../server/services/billing/undo-payment')

    await UndoPaymentService.undoPayment(event(), makeUser(), 'invoice-1', 'payment-2')

    expect(updatePaymentTotals).toHaveBeenCalledWith(
      expect.anything(),
      'invoice-1',
      600_000,
      400_000,
      'partial',
      null,
    )
  })

  it('returns 404 when the payment does not belong to the invoice', async () => {
    findInvoiceByIdentifier.mockResolvedValue(buildInvoice({ id: 'invoice-1', billingPeriodId: 'period-1' }))
    findPaymentById.mockResolvedValue(buildInvoicePayment({ id: 'payment-9', invoiceId: 'other-invoice' }))

    const { UndoPaymentService } = await import('../../../server/services/billing/undo-payment')

    await expect(
      UndoPaymentService.undoPayment(event(), makeUser(), 'invoice-1', 'payment-9'),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(softDelete).not.toHaveBeenCalled()
  })

  it('rejects when the period is closed', async () => {
    findInvoiceByIdentifier.mockResolvedValue(buildInvoice({ id: 'invoice-1', billingPeriodId: 'period-1' }))
    findPaymentById.mockResolvedValue(buildInvoicePayment({ id: 'payment-1', invoiceId: 'invoice-1' }))
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'closed' }))

    const { UndoPaymentService } = await import('../../../server/services/billing/undo-payment')

    await expect(
      UndoPaymentService.undoPayment(event(), makeUser(), 'invoice-1', 'payment-1'),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(softDelete).not.toHaveBeenCalled()
  })
})
