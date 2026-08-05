import { describe, expect, it } from 'vitest'
import type { BillingDraftInvoice, BillingDraftResponse } from '~/types/billing'
import { buildPeriod } from '../../__fixtures__/billing/period'
import {
  buildInvoiceIssueSnapshot,
  createInvoiceIssuePreview,
  hashInvoiceIssueSnapshot,
  type InvoiceIssueProfileFingerprint,
} from '../../../server/services/billing/invoice-issue-snapshot'

const contractId = '00000000-0000-4000-8000-000000000001'

function draft(overrides: Partial<BillingDraftInvoice> = {}): BillingDraftInvoice {
  return {
    contractId,
    roomId: '00000000-0000-4000-8000-000000000002',
    tenantId: '00000000-0000-4000-8000-000000000003',
    contractCode: 'HD-101',
    roomNumber: '101',
    tenantName: 'Nguyễn Văn An',
    lines: [{
      chargeType: 'rent',
      label: 'Tiền phòng',
      sourceType: null,
      sourceId: null,
      quantity: 1,
      unitPrice: 3_000_000,
      amount: 3_000_000,
      metadata: { source: 'contract' },
      sortOrder: 0,
    }],
    subtotalAmount: 3_000_000,
    discountAmount: 0,
    surchargeAmount: 0,
    totalAmount: 3_000_000,
    blockers: [],
    warnings: [],
    existingInvoiceId: null,
    existingInvoiceStatus: null,
    ...overrides,
  }
}

function response(drafts: BillingDraftInvoice[]): BillingDraftResponse {
  return {
    period: buildPeriod({
      id: '00000000-0000-4000-8000-000000000010',
      buildingId: '00000000-0000-4000-8000-000000000011',
      status: 'review',
      updatedAt: '2026-08-05T00:00:00.000Z',
    }),
    drafts,
    totals: {
      draftTotal: drafts.reduce((sum, row) => sum + row.totalAmount, 0),
      blockedDraftCount: drafts.filter(row => row.blockers.length > 0).length,
      issuableDraftCount: drafts.filter(row => row.blockers.length === 0 && !row.existingInvoiceId).length,
    },
  }
}

function profile(overrides: Partial<InvoiceIssueProfileFingerprint> = {}): InvoiceIssueProfileFingerprint {
  return {
    updatedAt: '2026-08-05T01:00:00.000Z',
    bankName: 'Vietcombank',
    accountHolder: 'ZENO HOUSE',
    accountNumber: '0123456789',
    transferContentTemplate: '{building_code} {room_number} {invoice_code} {period}',
    qrImagePath: 'building/qr.png',
    logoImagePath: 'building/logo.png',
    ...overrides,
  }
}

describe('invoice issue snapshot', () => {
  it('classifies requested drafts and hashes only the exact issuable targets', () => {
    const ready = draft()
    const blocked = draft({
      contractId: '00000000-0000-4000-8000-000000000004',
      blockers: [{ code: 'missing_current_reading', message: 'Thiếu chỉ số điện' }],
    })
    const existing = draft({
      contractId: '00000000-0000-4000-8000-000000000005',
      existingInvoiceId: '00000000-0000-4000-8000-000000000020',
      existingInvoiceStatus: 'issued',
    })

    const result = createInvoiceIssuePreview(
      response([blocked, existing, ready]),
      [blocked.contractId, existing.contractId, ready.contractId],
      '2026-08-09',
      profile(),
    )

    expect(result.targetContractIds).toEqual([ready.contractId])
    expect(result.preview).toMatchObject({
      issuableCount: 1,
      blockedCount: 1,
      alreadyIssuedCount: 1,
      totalAmount: 3_000_000,
      dueDate: '2026-08-09',
      snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
  })

  it('binds the hash to the payment profile and remains stable across object-key order', () => {
    const first = response([draft()])
    const reordered = structuredClone(first)
    reordered.drafts[0]!.lines[0]!.metadata = { nested: { b: 2, a: 1 }, source: 'contract' }
    first.drafts[0]!.lines[0]!.metadata = { source: 'contract', nested: { a: 1, b: 2 } }

    const firstSnapshot = buildInvoiceIssueSnapshot(first, [contractId], '2026-08-09', profile())
    const reorderedSnapshot = buildInvoiceIssueSnapshot(reordered, [contractId], '2026-08-09', profile())
    expect(hashInvoiceIssueSnapshot(firstSnapshot)).toBe(hashInvoiceIssueSnapshot(reorderedSnapshot))

    const changedProfile = buildInvoiceIssueSnapshot(
      first,
      [contractId],
      '2026-08-09',
      profile({ updatedAt: '2026-08-05T02:00:00.000Z' }),
    )
    expect(hashInvoiceIssueSnapshot(changedProfile)).not.toBe(hashInvoiceIssueSnapshot(firstSnapshot))
  })

  it('binds the hash to blocker state in the current period', () => {
    const selected = draft()
    const other = draft({ contractId: '00000000-0000-4000-8000-000000000004' })
    const first = response([selected, other])
    const changed = structuredClone(first)
    changed.drafts[1]!.blockers = [{ code: 'missing_rate', message: 'Thiếu đơn giá', meta: { meter: 'water' } }]

    const firstHash = createInvoiceIssuePreview(first, [contractId], '2026-08-09').preview.snapshotHash
    const changedHash = createInvoiceIssuePreview(changed, [contractId], '2026-08-09').preview.snapshotHash

    expect(changedHash).not.toBe(firstHash)
  })

  it('invalidates an issue preview when an incidental charge changes', () => {
    const firstDraft = draft({
      lines: [
        ...draft().lines,
        {
          chargeType: 'incidental',
          label: 'Thay khóa cửa',
          sourceType: 'billing_incidental_charge',
          sourceId: '00000000-0000-4000-8000-000000000030',
          quantity: 1,
          unitPrice: 150_000,
          amount: 150_000,
          metadata: { note: 'Theo biên bản bàn giao' },
          sortOrder: 80,
        },
      ],
      subtotalAmount: 3_150_000,
      totalAmount: 3_150_000,
    })
    const changed = structuredClone(firstDraft)
    changed.lines[1]!.amount = 200_000
    changed.lines[1]!.unitPrice = 200_000
    changed.subtotalAmount = 3_200_000
    changed.totalAmount = 3_200_000

    const firstHash = createInvoiceIssuePreview(response([firstDraft]), [contractId], '2026-08-09').preview.snapshotHash
    const changedHash = createInvoiceIssuePreview(response([changed]), [contractId], '2026-08-09').preview.snapshotHash

    expect(changedHash).not.toBe(firstHash)
  })
})
