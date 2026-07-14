import { describe, expect, it } from 'vitest'
import type { BillingDraftResponse } from '~/types/billing'
import { summarizeBillingDraft } from '../../../server/services/ai/draft-summary'

function response(): BillingDraftResponse {
  return {
    period: { id: 'period-1' } as BillingDraftResponse['period'],
    drafts: [{
      contractId: 'contract-1', roomId: 'room-1', tenantId: 'tenant-1', contractCode: 'C1',
      roomNumber: '101', tenantName: 'Tenant',
      lines: [
        { chargeType: 'rent', label: 'Rent', sourceType: null, sourceId: null, quantity: 1, unitPrice: 1000, amount: 1000, metadata: {}, sortOrder: 1 },
        { chargeType: 'electricity', label: 'Electricity', sourceType: null, sourceId: null, quantity: 10, unitPrice: 4, amount: 40, metadata: {}, sortOrder: 2 },
      ],
      subtotalAmount: 1040, discountAmount: 0, surchargeAmount: 0, totalAmount: 1040,
      blockers: [{ code: 'missing_current_reading', message: 'Missing' }],
      warnings: [{ code: 'handover_fallback_used', message: 'Fallback' }],
      existingInvoiceId: null, existingInvoiceStatus: null,
    }],
    totals: { draftTotal: 1040, blockedDraftCount: 1, issuableDraftCount: 0 },
  }
}

describe('summarizeBillingDraft', () => {
  it('derives deterministic totals, groups, and correction next step', () => {
    expect(summarizeBillingDraft(response())).toEqual({
      periodId: 'period-1', draftCount: 1, blockedDraftCount: 1, issuableDraftCount: 0,
      existingInvoiceCount: 0, draftTotal: 1040,
      chargeTotals: { electricity: 40, rent: 1000 },
      blockerGroups: [{ code: 'missing_current_reading', count: 1, rooms: ['101'] }],
      warningGroups: [{ code: 'handover_fallback_used', count: 1, rooms: ['101'] }],
      nextStep: 'correct_billing_inputs',
    })
  })

  it('uses authoritative response totals and does not mutate the draft', () => {
    const draft = response()
    const snapshot = structuredClone(draft)
    draft.totals.draftTotal = 9999
    expect(summarizeBillingDraft(draft).draftTotal).toBe(9999)
    expect({ ...draft, totals: snapshot.totals }).toEqual(snapshot)
  })
})
