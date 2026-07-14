import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingDraftInvoice, BillingDraftResponse } from '~/types/billing'
import { buildPeriod } from '../../__fixtures__/billing/period'
import { aiToolPlanInvoiceIssueSchema } from '../../../app/utils/validators/ai'
import {
  buildInvoiceIssueSnapshot,
  createInvoiceIssuePreview,
} from '../../../server/services/ai/invoice-issue-snapshot'

const calculateDraft = vi.fn()
const createPlan = vi.fn()

vi.mock('../../../server/services/billing/drafts', () => ({
  BillingDraftService: { calculateDraft },
}))
vi.mock('../../../server/services/ai/actions', () => ({
  AiActionService: { createPlan },
}))

function draft(overrides: Partial<BillingDraftInvoice> = {}): BillingDraftInvoice {
  return {
    contractId: '00000000-0000-4000-8000-000000000001',
    roomId: '00000000-0000-4000-8000-000000000002',
    tenantId: '00000000-0000-4000-8000-000000000003',
    contractCode: 'C1', roomNumber: '101', tenantName: 'Tenant',
    lines: [{
      chargeType: 'rent', label: 'Tiền phòng', sourceType: null, sourceId: null,
      quantity: 1, unitPrice: 1_000_000, amount: 1_000_000,
      metadata: { source: 'contract', nested: { b: 2, a: 1 } }, sortOrder: 0,
    }],
    subtotalAmount: 1_000_000, discountAmount: 0, surchargeAmount: 0, totalAmount: 1_000_000,
    blockers: [], warnings: [], existingInvoiceId: null, existingInvoiceStatus: null,
    ...overrides,
  }
}

function response(drafts: BillingDraftInvoice[]): BillingDraftResponse {
  return {
    period: buildPeriod({
      id: '00000000-0000-4000-8000-000000000010',
      buildingId: '00000000-0000-4000-8000-000000000011',
      status: 'review',
    }),
    drafts,
    totals: {
      draftTotal: drafts.reduce((sum, row) => sum + row.totalAmount, 0),
      blockedDraftCount: drafts.filter(row => row.blockers.length > 0).length,
      issuableDraftCount: drafts.filter(row => row.blockers.length === 0 && !row.existingInvoiceId).length,
    },
  }
}

describe('AI invoice issue planning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', () => true)
    createPlan.mockResolvedValue({
      id: 'plan-1', conversationId: 'conversation-1', actionType: 'issue_invoices',
      status: 'pending', title: 'Issue', summary: 'Issue', buildingId: 'building-1',
      preview: {}, warnings: [], expiresAt: '2026-07-14T01:00:00.000Z', result: null, error: null,
    })
  })

  it('rejects model-supplied totals and charge lines at the strict tool boundary', () => {
    const base = {
      period_id: '00000000-0000-4000-8000-000000000010',
      contract_ids: ['00000000-0000-4000-8000-000000000001'],
      due_date: '2026-07-31',
    }
    expect(aiToolPlanInvoiceIssueSchema.safeParse(base).success).toBe(true)
    expect(aiToolPlanInvoiceIssueSchema.safeParse({ ...base, total: 1, lines: [] }).success).toBe(false)
  })

  it('hashes canonical authoritative snapshots independent of object key order', () => {
    const first = response([draft()])
    const reordered = structuredClone(first)
    reordered.drafts[0]!.lines[0]!.metadata = { nested: { a: 1, b: 2 }, source: 'contract' }
    const firstPreview = createInvoiceIssuePreview(first, undefined, '2026-07-31').preview
    const secondPreview = createInvoiceIssuePreview(reordered, undefined, '2026-07-31').preview
    expect(firstPreview.snapshotHash).toBe(secondPreview.snapshotHash)
    expect(buildInvoiceIssueSnapshot(first, [first.drafts[0]!.contractId], '2026-07-31'))
      .toEqual(buildInvoiceIssueSnapshot(reordered, [first.drafts[0]!.contractId], '2026-07-31'))
  })

  it('stores only exact issuable targets and authoritative snapshot hash', async () => {
    const ready = draft()
    const blocked = draft({
      contractId: '00000000-0000-4000-8000-000000000004',
      blockers: [{ code: 'missing_current_reading', message: 'Missing' }],
    })
    calculateDraft.mockResolvedValue(response([blocked, ready]))
    const { AiInvoiceIssuePlanner } = await import('../../../server/services/ai/invoice-issue-planner')
    const result = await AiInvoiceIssuePlanner.plan(
      {} as never,
      { id: 'user-1', app_metadata: { role: 'admin' } } as never,
      'conversation-1', {
      period_id: '00000000-0000-4000-8000-000000000010',
      due_date: '2026-07-31',
      },
    )

    expect(result.status).toBe('planned')
    expect(createPlan).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action_type: 'issue_invoices',
      normalized_payload: {
        period_id: '00000000-0000-4000-8000-000000000010',
        contract_ids: [ready.contractId],
        due_date: '2026-07-31',
        snapshot_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      warnings: ['Loại 1 dự thảo đang có lỗi chặn.'],
    }))
    const payload = createPlan.mock.calls[0]![2].normalized_payload
    expect(payload).not.toHaveProperty('total')
    expect(payload).not.toHaveProperty('lines')
  })

  it('returns preview only when no selected draft is issuable', async () => {
    const blocked = draft({ blockers: [{ code: 'missing_current_reading', message: 'Missing' }] })
    calculateDraft.mockResolvedValue(response([blocked]))
    const { AiInvoiceIssuePlanner } = await import('../../../server/services/ai/invoice-issue-planner')
    const result = await AiInvoiceIssuePlanner.plan(
      {} as never,
      { id: 'user-1', app_metadata: { role: 'admin' } } as never,
      'conversation-1', {
      period_id: '00000000-0000-4000-8000-000000000010',
      },
    )
    expect(result).toMatchObject({ status: 'preview_only', preview: { issuableCount: 0, blockedCount: 1 } })
    expect(createPlan).not.toHaveBeenCalled()
  })
})
