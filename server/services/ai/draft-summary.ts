import type { AiBillingDraftExplanation } from '~/types/ai'
import type { BillingDraftResponse } from '~/types/billing'

function groupIssues(
  draft: BillingDraftResponse,
  type: 'blockers' | 'warnings',
): Array<{ code: string; count: number; rooms: string[] }> {
  const groups = new Map<string, { code: string; count: number; rooms: Set<string> }>()
  for (const row of draft.drafts) {
    for (const issue of row[type]) {
      const group = groups.get(issue.code) ?? { code: issue.code, count: 0, rooms: new Set<string>() }
      group.count += 1
      group.rooms.add(row.roomNumber ?? row.roomId)
      groups.set(issue.code, group)
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(group => ({ code: group.code, count: group.count, rooms: [...group.rooms].sort() }))
}

export function summarizeBillingDraft(draft: BillingDraftResponse): AiBillingDraftExplanation {
  const chargeTotals: Record<string, number> = {}
  for (const row of draft.drafts) {
    for (const line of row.lines) {
      chargeTotals[line.chargeType] = (chargeTotals[line.chargeType] ?? 0) + line.amount
    }
  }
  const existingInvoiceCount = draft.drafts.filter(row => row.existingInvoiceId !== null).length
  const nextStep = draft.totals.blockedDraftCount > 0
    ? 'correct_billing_inputs'
    : draft.drafts.length === 0
      ? 'no_billable_contracts'
      : draft.totals.issuableDraftCount > 0
        ? 'preview_invoice_issue'
        : 'review_existing_invoices'

  return {
    periodId: draft.period.id,
    draftCount: draft.drafts.length,
    blockedDraftCount: draft.totals.blockedDraftCount,
    issuableDraftCount: draft.totals.issuableDraftCount,
    existingInvoiceCount,
    draftTotal: draft.totals.draftTotal,
    chargeTotals: Object.fromEntries(Object.entries(chargeTotals).sort(([a], [b]) => a.localeCompare(b))),
    blockerGroups: groupIssues(draft, 'blockers'),
    warningGroups: groupIssues(draft, 'warnings'),
    nextStep,
  }
}
