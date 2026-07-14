import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const getWithCharges = vi.fn()
const findPeriodById = vi.fn()
const findActiveByPeriodContract = vi.fn()
const calculateDraft = vi.fn()
const findLatestCorrelation = vi.fn()
const createPlan = vi.fn()

vi.mock('../../../server/services/billing/invoices', () => ({ InvoiceService: { getWithCharges } }))
vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findById: findPeriodById },
}))
vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: { findActiveByPeriodContract },
}))
vi.mock('../../../server/services/billing/drafts', () => ({ BillingDraftService: { calculateDraft } }))
vi.mock('../../../server/repositories/billing/audit', () => ({
  BillingAuditRepository: { findLatestCorrelation },
}))
vi.mock('../../../server/services/ai/actions', () => ({ AiActionService: { createPlan } }))

const user = { id: 'user-1', app_metadata: { role: 'admin' } } as never
const event = {} as never
const period = buildPeriod({
  id: '00000000-0000-4000-8000-000000000010',
  buildingId: '00000000-0000-4000-8000-000000000011',
  status: 'issued',
})

function planResult(actionType: string) {
  return {
    id: 'plan-1', conversationId: 'conversation-1', actionType,
    status: 'pending', title: 'Plan', summary: 'Plan', buildingId: period.buildingId,
    preview: {}, warnings: [], expiresAt: '2026-07-14T01:00:00.000Z', result: null, error: null,
  }
}

describe('AI invoice correction planner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findPeriodById.mockResolvedValue(period)
    findActiveByPeriodContract.mockResolvedValue(null)
    findLatestCorrelation.mockResolvedValue('00000000-0000-4000-8000-000000000012')
  })

  it('plans an unpaid void with the exact invoice version', async () => {
    const invoice = buildInvoice({ status: 'issued', paidAmount: 0 })
    getWithCharges.mockResolvedValue({ invoice, charges: [], payments: [] })
    createPlan.mockResolvedValue(planResult('void_invoice'))
    const { AiInvoiceCorrectionPlanner } = await import('../../../server/services/ai/invoice-correction-planner')
    await AiInvoiceCorrectionPlanner.planVoid(event, user, 'conversation-1', {
      invoice_ref: invoice.invoiceCode,
      reason: 'Sai chỉ số điện tháng này',
    })
    expect(createPlan).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action_type: 'void_invoice',
      normalized_payload: {
        invoice_id: invoice.id,
        reason: 'Sai chỉ số điện tháng này',
        expected_updated_at: invoice.updatedAt,
      },
    }))
  })

  it('rejects void when payment state requires explicit correction handling', async () => {
    const invoice = buildInvoice({ status: 'partial', paidAmount: 100_000 })
    getWithCharges.mockResolvedValue({ invoice, charges: [], payments: [{ id: 'payment-1' }] })
    const { AiInvoiceCorrectionPlanner } = await import('../../../server/services/ai/invoice-correction-planner')
    await expect(AiInvoiceCorrectionPlanner.planVoid(event, user, 'conversation-1', {
      invoice_ref: invoice.id,
      reason: 'Sai chỉ số điện tháng này',
    })).rejects.toMatchObject({ statusCode: 409 })
    expect(createPlan).not.toHaveBeenCalled()
  })

  it('binds reissue to the void version, fresh draft, and void correlation', async () => {
    const invoice = buildInvoice({ status: 'void', voidReason: 'Sai chỉ số' })
    getWithCharges.mockResolvedValue({ invoice, charges: [], payments: [] })
    calculateDraft.mockResolvedValue({
      period,
      drafts: [{
        contractId: invoice.contractId, roomId: invoice.roomId, tenantId: invoice.tenantId,
        contractCode: null, roomNumber: null, tenantName: null, lines: [],
        subtotalAmount: 900_000, discountAmount: 0, surchargeAmount: 0, totalAmount: 900_000,
        blockers: [], warnings: [], existingInvoiceId: null, existingInvoiceStatus: null,
      }],
      totals: { draftTotal: 900_000, blockedDraftCount: 0, issuableDraftCount: 1 },
    })
    createPlan.mockResolvedValue(planResult('reissue_invoice'))
    const { AiInvoiceCorrectionPlanner } = await import('../../../server/services/ai/invoice-correction-planner')
    await AiInvoiceCorrectionPlanner.planReissue(event, user, 'conversation-1', {
      invoice_ref: invoice.id,
      reason: 'Phát hành lại sau đính chính',
      due_date: '2026-07-31',
    })
    expect(createPlan).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action_type: 'reissue_invoice',
      normalized_payload: expect.objectContaining({
        invoice_id: invoice.id,
        expected_updated_at: invoice.updatedAt,
        snapshot_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        correlation_id: '00000000-0000-4000-8000-000000000012',
      }),
    }))
  })

  it('previews paid adjustment totals without mutating payments', async () => {
    const invoice = buildInvoice({ status: 'paid', totalAmount: 1_000_000, paidAmount: 1_000_000, balanceAmount: 0 })
    getWithCharges.mockResolvedValue({ invoice, charges: [], payments: [{ id: 'payment-1' }] })
    createPlan.mockResolvedValue(planResult('add_invoice_adjustment'))
    const { AiInvoiceCorrectionPlanner } = await import('../../../server/services/ai/invoice-correction-planner')
    await AiInvoiceCorrectionPlanner.planPaidAdjustment(event, user, 'conversation-1', {
      invoice_ref: invoice.id,
      label: 'Bổ sung tiền điện',
      amount: 100_000,
      reason: 'Chỉ số điện được đính chính',
    })
    expect(createPlan).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action_type: 'add_invoice_adjustment',
      preview: expect.objectContaining({
        total_before: 1_000_000,
        total_after: 1_100_000,
        balance_after: 100_000,
        status_after: 'partial',
        payment_mutation: false,
      }),
    }))
  })

  it('preserves out-of-scope hiding and closed-period locks from domain services', async () => {
    getWithCharges.mockRejectedValueOnce(Object.assign(new Error('Not found'), { statusCode: 404 }))
    const { AiInvoiceCorrectionPlanner } = await import('../../../server/services/ai/invoice-correction-planner')
    await expect(AiInvoiceCorrectionPlanner.planVoid(event, user, 'conversation-1', {
      invoice_ref: 'foreign-invoice', reason: 'Sai chỉ số điện tháng này',
    })).rejects.toMatchObject({ statusCode: 404 })

    const invoice = buildInvoice({ status: 'paid', paidAmount: 1_000_000 })
    getWithCharges.mockResolvedValueOnce({ invoice, charges: [], payments: [] })
    findPeriodById.mockResolvedValueOnce(buildPeriod({ ...period, status: 'closed' }))
    await expect(AiInvoiceCorrectionPlanner.planPaidAdjustment(event, user, 'conversation-1', {
      invoice_ref: invoice.id, label: 'Điều chỉnh', amount: 10_000, reason: 'Đính chính',
    })).rejects.toMatchObject({ statusCode: 409 })
    expect(createPlan).not.toHaveBeenCalled()
  })
})
