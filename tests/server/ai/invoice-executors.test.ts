import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan } from '~/types/ai'
import type { BillingDraftResponse } from '~/types/billing'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'
import { hashAgentPayload } from '../../../server/utils/ai'
import { buildInvoiceIssueSnapshot } from '../../../server/services/ai/invoice-issue-snapshot'

const calculateDraft = vi.fn()
const issueInvoices = vi.fn()
const voidInvoice = vi.fn()
const reissueInvoice = vi.fn()
const addAdjustment = vi.fn()
const getWithCharges = vi.fn()

vi.mock('../../../server/services/billing/drafts', () => ({ BillingDraftService: { calculateDraft } }))
vi.mock('../../../server/services/billing/invoices', () => ({
  InvoiceService: { issueInvoices, voidInvoice, reissueInvoice, addAdjustment, getWithCharges },
}))

const periodId = '00000000-0000-4000-8000-000000000010'
const contractId = '00000000-0000-4000-8000-000000000001'
const invoiceId = '00000000-0000-4000-8000-000000000020'
const user = { id: 'user-1', app_metadata: { role: 'admin' } } as never

function draftResponse(total = 1_000_000): BillingDraftResponse {
  return {
    period: buildPeriod({ id: periodId, status: 'review' }),
    drafts: [{
      contractId,
      roomId: '00000000-0000-4000-8000-000000000002',
      tenantId: '00000000-0000-4000-8000-000000000003',
      contractCode: null, roomNumber: '101', tenantName: null,
      lines: [{
        chargeType: 'rent', label: 'Tiền phòng', sourceType: null, sourceId: null,
        quantity: 1, unitPrice: total, amount: total, metadata: {}, sortOrder: 0,
      }],
      subtotalAmount: total, discountAmount: 0, surchargeAmount: 0, totalAmount: total,
      blockers: [], warnings: [], existingInvoiceId: null, existingInvoiceStatus: null,
    }],
    totals: { draftTotal: total, blockedDraftCount: 0, issuableDraftCount: 1 },
  }
}

function plan(actionType: string, payload: Record<string, unknown>, resourceVersions = {}): AiActionPlan {
  return {
    id: 'plan-1', conversationId: 'conversation-1', userId: 'user-1', buildingId: 'building-1',
    actionType, title: 'Plan', summary: 'Plan', normalizedPayload: payload, payloadHash: 'hash',
    preview: {}, warnings: [], resourceVersions, idempotencyKey: '00000000-0000-4000-8000-000000000099',
    status: 'executing', result: null, error: null, expiresAt: '2026-07-14T01:00:00.000Z',
    confirmedAt: null, executedAt: null, createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  }
}

describe('AI invoice executors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revalidates issue snapshot and uses the plan idempotency key', async () => {
    const response = draftResponse()
    const hash = hashAgentPayload(buildInvoiceIssueSnapshot(response, [contractId], null), {})
    calculateDraft.mockResolvedValue(response)
    issueInvoices.mockResolvedValue({ issuedCount: 1, invoices: [] })
    const { ISSUE_INVOICES_EXECUTOR } = await import('../../../server/services/ai/invoice-executors')
    const action = plan('issue_invoices', {
      period_id: periodId, contract_ids: [contractId], due_date: null, snapshot_hash: hash,
    }, { draft_snapshot: hash })
    const context = { event: {} as never, user, plan: action, idempotencyKey: action.idempotencyKey }
    await ISSUE_INVOICES_EXECUTOR.revalidate?.(context)
    await ISSUE_INVOICES_EXECUTOR.execute(context)
    expect(issueInvoices).toHaveBeenCalledWith(expect.anything(), user, periodId, {
      contract_ids: [contractId], due_date: null,
    }, { operationId: action.idempotencyKey })
  })

  it('marks a changed issue preview as an optimistic conflict before write', async () => {
    const original = draftResponse()
    const hash = hashAgentPayload(buildInvoiceIssueSnapshot(original, [contractId], null), {})
    calculateDraft.mockResolvedValue(draftResponse(1_100_000))
    const { ISSUE_INVOICES_EXECUTOR } = await import('../../../server/services/ai/invoice-executors')
    const action = plan('issue_invoices', {
      period_id: periodId, contract_ids: [contractId], due_date: null, snapshot_hash: hash,
    }, { draft_snapshot: hash })
    await expect(ISSUE_INVOICES_EXECUTOR.revalidate?.({
      event: {} as never, user, plan: action, idempotencyKey: action.idempotencyKey,
    })).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'OPTIMISTIC_LOCK_CONFLICT' } } },
    })
    expect(issueInvoices).not.toHaveBeenCalled()
  })

  it('executes correction plans only from stored payload and server operation ids', async () => {
    const expectedUpdatedAt = '2026-07-14T00:00:00.000Z'
    const { VOID_INVOICE_EXECUTOR, ADD_INVOICE_ADJUSTMENT_EXECUTOR } = await import('../../../server/services/ai/invoice-executors')
    const voidPlan = plan('void_invoice', {
      invoice_id: invoiceId, reason: 'Sai chỉ số điện tháng này', expected_updated_at: expectedUpdatedAt,
    })
    await VOID_INVOICE_EXECUTOR.execute({
      event: {} as never, user, plan: voidPlan, idempotencyKey: voidPlan.idempotencyKey,
    })
    expect(voidInvoice).toHaveBeenCalledWith(expect.anything(), user, invoiceId, {
      reason: 'Sai chỉ số điện tháng này', expected_updated_at: expectedUpdatedAt,
    }, { correlationId: voidPlan.idempotencyKey })

    const adjustmentPlan = plan('add_invoice_adjustment', {
      invoice_id: invoiceId, label: 'Bổ sung tiền điện', amount: 100_000,
      reason: 'Đính chính chỉ số', reference_invoice_id: null, expected_updated_at: expectedUpdatedAt,
    })
    await ADD_INVOICE_ADJUSTMENT_EXECUTOR.execute({
      event: {} as never, user, plan: adjustmentPlan, idempotencyKey: adjustmentPlan.idempotencyKey,
    })
    expect(addAdjustment).toHaveBeenCalledWith(expect.anything(), user, expect.objectContaining({
      target_invoice_id: invoiceId, expected_updated_at: expectedUpdatedAt, amount: 100_000,
    }), { correlationId: adjustmentPlan.idempotencyKey })
  })

  it('preserves the stored void correlation when reissuing', async () => {
    const response = draftResponse()
    const hash = hashAgentPayload(buildInvoiceIssueSnapshot(response, [contractId], null), {})
    const invoice = buildInvoice({ id: invoiceId, contractId, billingPeriodId: periodId, status: 'void' })
    getWithCharges.mockResolvedValue({ invoice, charges: [], payments: [] })
    calculateDraft.mockResolvedValue(response)
    const { REISSUE_INVOICE_EXECUTOR } = await import('../../../server/services/ai/invoice-executors')
    const action = plan('reissue_invoice', {
      invoice_id: invoiceId, reason: 'Phát hành lại sau đính chính', due_date: null, notes: null,
      expected_updated_at: invoice.updatedAt, snapshot_hash: hash,
      correlation_id: '00000000-0000-4000-8000-000000000088',
    }, { draft_snapshot: hash })
    const context = { event: {} as never, user, plan: action, idempotencyKey: action.idempotencyKey }
    await REISSUE_INVOICE_EXECUTOR.revalidate?.(context)
    await REISSUE_INVOICE_EXECUTOR.execute(context)
    expect(reissueInvoice).toHaveBeenCalledWith(expect.anything(), user, invoiceId, expect.any(Object), {
      correlationId: '00000000-0000-4000-8000-000000000088',
    })
  })
})
