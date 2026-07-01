import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'

const findPeriodById = vi.fn()
const calculateDraft = vi.fn()
const enrichInvoices = vi.fn(async (invoices: unknown[]) => invoices)
const rpcMock = vi.fn()
const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    findById: findPeriodById,
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

function buildReadyDraft(contractId = 'contract-ready', total = 1_720_000) {
  return {
    contractId,
    roomId: 'room-ready',
    tenantId: 'tenant-ready',
    subtotalAmount: total,
    discountAmount: 0,
    surchargeAmount: 0,
    totalAmount: total,
    blockers: [],
    existingInvoiceId: null,
    lines: [
      {
        chargeType: 'rent',
        label: 'Tiền phòng',
        sourceType: null,
        sourceId: null,
        quantity: 1,
        unitPrice: total,
        amount: total,
        sortOrder: 0,
        metadata: {},
      },
    ],
  }
}

function paidInvoiceRow(total = 1_720_000) {
  const issued = buildInvoice({ id: 'invoice-paid', totalAmount: total })
  return {
    id: issued.id,
    invoice_code: issued.invoiceCode,
    billing_period_id: issued.billingPeriodId,
    contract_id: issued.contractId,
    room_id: issued.roomId,
    tenant_id: issued.tenantId,
    status: 'paid',
    due_date: '2026-06-05',
    issued_at: issued.issuedAt,
    paid_at: '2026-05-31',
    voided_at: null,
    voided_by: null,
    void_reason: null,
    superseded_by_invoice_id: null,
    supersedes_invoice_id: null,
    subtotal_amount: total,
    discount_amount: 0,
    surcharge_amount: 0,
    total_amount: total,
    paid_amount: total,
    balance_amount: 0,
    notes: null,
    created_at: issued.createdAt,
    updated_at: issued.updatedAt,
  }
}

describe('IssueAndPayService.issueAndPay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', () => true)
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'issued' }))
  })

  it('issues a ready draft and records full payment via the issue_and_pay RPC', async () => {
    calculateDraft.mockResolvedValue({
      totals: { blockedDraftCount: 0, issuableDraftCount: 1 },
      drafts: [buildReadyDraft()],
    })
    rpcMock.mockResolvedValueOnce({ data: [paidInvoiceRow()], error: null })

    const { IssueAndPayService } = await import('../../../server/services/billing/issue-and-pay')

    const result = await IssueAndPayService.issueAndPay(event(), makeUser(), 'period-1', {
      contract_id: 'contract-ready',
      payment_date: '2026-05-31',
      payment_method: 'cash',
      note: null,
    })

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [fnName, args] = rpcMock.mock.calls[0]!
    expect(fnName).toBe('issue_and_pay')
    expect(args).toMatchObject({
      p_period_id: 'period-1',
      p_contract_id: 'contract-ready',
      p_actor_id: 'user-1',
      p_payment_date: '2026-05-31',
      p_payment_method: 'cash',
      p_draft: expect.objectContaining({
        contract_id: 'contract-ready',
        total: 1_720_000,
      }),
    })
    expect(result.status).toBe('paid')
    expect(result.balanceAmount).toBe(0)
  })

  it('rejects when the draft still has blockers', async () => {
    calculateDraft.mockResolvedValue({
      totals: { blockedDraftCount: 1, issuableDraftCount: 0 },
      drafts: [{
        ...buildReadyDraft(),
        blockers: [{ code: 'missing_current_reading', message: 'missing', meta: {} }],
      }],
    })

    const { IssueAndPayService } = await import('../../../server/services/billing/issue-and-pay')

    await expect(
      IssueAndPayService.issueAndPay(event(), makeUser(), 'period-1', {
        contract_id: 'contract-ready',
        payment_date: '2026-05-31',
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rejects when the contract already has an invoice in the period', async () => {
    calculateDraft.mockResolvedValue({
      totals: { blockedDraftCount: 0, issuableDraftCount: 0 },
      drafts: [{ ...buildReadyDraft(), existingInvoiceId: 'invoice-existing' }],
    })

    const { IssueAndPayService } = await import('../../../server/services/billing/issue-and-pay')

    await expect(
      IssueAndPayService.issueAndPay(event(), makeUser(), 'period-1', {
        contract_id: 'contract-ready',
        payment_date: '2026-05-31',
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rejects when the period is closed before touching drafts', async () => {
    findPeriodById.mockResolvedValue(buildPeriod({ id: 'period-1', status: 'closed' }))

    const { IssueAndPayService } = await import('../../../server/services/billing/issue-and-pay')

    await expect(
      IssueAndPayService.issueAndPay(event(), makeUser(), 'period-1', {
        contract_id: 'contract-ready',
        payment_date: '2026-05-31',
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(calculateDraft).not.toHaveBeenCalled()
  })

  it('maps the RPC ALREADY_ISSUED error code to a 409 conflict', async () => {
    calculateDraft.mockResolvedValue({
      totals: { blockedDraftCount: 0, issuableDraftCount: 1 },
      drafts: [buildReadyDraft()],
    })
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        message: 'already issued',
        details: JSON.stringify({ error_code: 'ALREADY_ISSUED' }),
      },
    })

    const { IssueAndPayService } = await import('../../../server/services/billing/issue-and-pay')

    await expect(
      IssueAndPayService.issueAndPay(event(), makeUser(), 'period-1', {
        contract_id: 'contract-ready',
        payment_date: '2026-05-31',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { code: 'CONFLICT' } },
    })
  })

  it('returns 404 when the period does not exist', async () => {
    findPeriodById.mockResolvedValue(null)

    const { IssueAndPayService } = await import('../../../server/services/billing/issue-and-pay')

    await expect(
      IssueAndPayService.issueAndPay(event(), makeUser(), 'missing', {
        contract_id: 'contract-ready',
        payment_date: '2026-05-31',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
