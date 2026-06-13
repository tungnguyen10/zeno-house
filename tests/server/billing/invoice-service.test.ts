import { vi } from 'vitest'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findInvoiceById = vi.fn()
const voidById = vi.fn()
const findActiveByPeriodContract = vi.fn()
const issueOne = vi.fn()
const linkSupersededBy = vi.fn()
const findPeriodById = vi.fn()
const append = vi.fn()
const calculateDraft = vi.fn()
const enrichInvoices = vi.fn(async invoices => invoices)

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    findById: findInvoiceById,
    voidById,
    findActiveByPeriodContract,
    issueOne,
    linkSupersededBy,
  },
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findById: findPeriodById,
  },
}))

vi.mock('../../../server/repositories/billing/payments', () => ({
  InvoicePaymentRepository: {},
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: {
    append,
  },
}))

vi.mock('../../../server/services/billing/drafts', () => ({
  BillingDraftService: {
    calculateDraft,
  },
}))

vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return { enrichInvoices }
  }),
}))

describe('InvoiceService invoice lifecycle methods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'issued' }))
  })

  it('voids an issued invoice with no payments and records audit metadata', async () => {
    const invoice = buildInvoice({ id: 'invoice-1', paidAmount: 0, status: 'issued' })
    const voided = buildInvoice({ ...invoice, status: 'void', voidReason: 'wrong reading' })
    findInvoiceById.mockResolvedValue(invoice)
    voidById.mockResolvedValue(voided)
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.voidInvoice({} as never, { id: 'user-1' } as never, invoice.id, { reason: 'wrong reading' })

    expect(result.status).toBe('void')
    expect(voidById).toHaveBeenCalledWith(expect.anything(), invoice.id, 'user-1', 'wrong reading')
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'invoice.voided',
      metadata: expect.objectContaining({ reason: 'wrong reading', total_amount: invoice.totalAmount }),
    }))
  })

  it('blocks voiding invoices that already have payments', async () => {
    findInvoiceById.mockResolvedValue(buildInvoice({ paidAmount: 100_000, status: 'partial' }))
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    await expect(InvoiceService.voidInvoice({} as never, { id: 'user-1' } as never, 'invoice-1', { reason: 'wrong reading' }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(voidById).not.toHaveBeenCalled()
  })

  it('reissues a voided invoice and links the replacement to the original invoice', async () => {
    const voided = buildInvoice({ id: 'invoice-old', status: 'void', paidAmount: 0, voidReason: 'wrong reading' })
    const replacement = buildInvoice({ id: 'invoice-new', supersedesInvoiceId: voided.id })
    findInvoiceById.mockResolvedValue(voided)
    findActiveByPeriodContract.mockResolvedValue(null)
    calculateDraft.mockResolvedValue({
      drafts: [{
        contractId: voided.contractId,
        roomId: voided.roomId,
        tenantId: voided.tenantId,
        subtotalAmount: 1_000_000,
        discountAmount: 0,
        surchargeAmount: 0,
        totalAmount: 1_000_000,
        blockers: [],
        lines: [],
      }],
    })
    issueOne.mockResolvedValue({ invoice: replacement, charges: [] })
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.reissueInvoice({} as never, { id: 'user-1' } as never, voided.id, { due_date: '2026-06-05' })

    expect(result.id).toBe(replacement.id)
    expect(issueOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ supersedes_invoice_id: voided.id }),
      [],
    )
    expect(linkSupersededBy).toHaveBeenCalledWith(expect.anything(), voided.id, replacement.id)
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'invoice.reissued',
      metadata: expect.objectContaining({ replacement_for_invoice_id: voided.id }),
    }))
  })
})
