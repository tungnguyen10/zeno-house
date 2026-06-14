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

  it('issues only ready drafts and preserves invoice charge calculation metadata', async () => {
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'issued' }))
    const issued = buildInvoice({ id: 'invoice-issued', totalAmount: 1_720_000 })
    calculateDraft.mockResolvedValue({
      totals: {
        blockedDraftCount: 1,
        issuableDraftCount: 1,
      },
      drafts: [
        {
          contractId: 'contract-ready',
          roomId: 'room-ready',
          tenantId: 'tenant-ready',
          subtotalAmount: 1_820_000,
          discountAmount: 100_000,
          surchargeAmount: 0,
          totalAmount: 1_720_000,
          blockers: [],
          existingInvoiceId: null,
          lines: [
            {
              chargeType: 'electricity',
              label: 'Electricity replacement usage',
              sourceType: 'override',
              sourceId: 'override-1',
              quantity: 35,
              unitPrice: 4_000,
              amount: 140_000,
              sortOrder: 20,
              metadata: {
                source: 'usage_override',
                previous_reading_id: 'prev-reading',
                previous_reading_value: 100,
                current_reading_id: 'current-reading',
                current_reading_value: 5,
                old_meter_final_value: 130,
                new_meter_start_value: 0,
                billable_usage: 35,
                rate: 4_000,
                pricing_type: 'per_kwh',
              },
            },
          ],
        },
        {
          contractId: 'contract-blocked',
          roomId: 'room-blocked',
          tenantId: 'tenant-blocked',
          subtotalAmount: 0,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 0,
          blockers: [{ code: 'missing_current_reading', message: 'missing', meta: {} }],
          existingInvoiceId: null,
          lines: [],
        },
        {
          contractId: 'contract-existing',
          roomId: 'room-existing',
          tenantId: 'tenant-existing',
          subtotalAmount: 1_000_000,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 1_000_000,
          blockers: [],
          existingInvoiceId: 'invoice-existing',
          lines: [],
        },
      ],
    })
    issueOne.mockResolvedValue({ invoice: issued, charges: [] })
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.issueInvoices(
      {} as never,
      { id: 'user-1' } as never,
      'period-1',
      { due_date: '2026-06-05' },
    )

    expect(result.issuedCount).toBe(1)
    expect(issueOne).toHaveBeenCalledTimes(1)
    expect(issueOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        contract_id: 'contract-ready',
        total: 1_720_000,
      }),
      [expect.objectContaining({
        charge_type: 'electricity',
        source_type: 'override',
        source_id: 'override-1',
        quantity: 35,
        metadata: expect.objectContaining({
          source: 'usage_override',
          previous_reading_value: 100,
          current_reading_value: 5,
          old_meter_final_value: 130,
          new_meter_start_value: 0,
          billable_usage: 35,
          pricing_type: 'per_kwh',
        }),
      })],
    )
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'invoices.issued',
      metadata: expect.objectContaining({ issued_count: 1, invoice_ids: ['invoice-issued'] }),
    }))
  })

  it('audits an issue attempt and creates no invoices when all drafts are blocked or already issued', async () => {
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'review' }))
    calculateDraft.mockResolvedValue({
      totals: {
        blockedDraftCount: 1,
        issuableDraftCount: 0,
      },
      drafts: [
        {
          contractId: 'contract-blocked',
          roomId: 'room-blocked',
          tenantId: 'tenant-blocked',
          subtotalAmount: 0,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 0,
          blockers: [{ code: 'missing_current_reading', message: 'missing', meta: {} }],
          existingInvoiceId: null,
          lines: [],
        },
        {
          contractId: 'contract-existing',
          roomId: 'room-existing',
          tenantId: 'tenant-existing',
          subtotalAmount: 1_000_000,
          discountAmount: 0,
          surchargeAmount: 0,
          totalAmount: 1_000_000,
          blockers: [],
          existingInvoiceId: 'invoice-existing',
          lines: [],
        },
      ],
    })
    const { InvoiceService } = await import('../../../server/services/billing/invoices')

    const result = await InvoiceService.issueInvoices(
      {} as never,
      { id: 'user-1' } as never,
      'period-1',
      { due_date: '2026-06-05' },
    )

    expect(result).toEqual({ issuedCount: 0, invoices: [] })
    expect(issueOne).not.toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'invoice.issue_attempted',
      metadata: expect.objectContaining({ blocked_count: 1, issuable_count: 0, issued: 0 }),
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

    const result = await InvoiceService.reissueInvoice(
      {} as never,
      { id: 'user-1' } as never,
      voided.id,
      { due_date: '2026-06-05', reason: 'wrong reading fixed' },
    )

    expect(result.id).toBe(replacement.id)
    expect(issueOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ supersedes_invoice_id: voided.id }),
      [],
    )
    expect(linkSupersededBy).toHaveBeenCalledWith(expect.anything(), voided.id, replacement.id)
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'invoice.reissued',
      metadata: expect.objectContaining({
        reason: 'wrong reading fixed',
        replacement_for_invoice_id: voided.id,
      }),
    }))
  })
})
