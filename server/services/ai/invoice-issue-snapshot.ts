import type { AiInvoiceIssuePreview, AiInvoiceIssuePreviewItem } from '~/types/ai'
import type { BillingDraftInvoice, BillingDraftResponse } from '~/types/billing'
import { hashAgentPayload } from '../../utils/ai'

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function previewItem(draft: BillingDraftInvoice): AiInvoiceIssuePreviewItem {
  return {
    contractId: draft.contractId,
    roomId: draft.roomId,
    tenantId: draft.tenantId,
    totalAmount: draft.totalAmount,
    blockerCodes: sortedUnique(draft.blockers.map(blocker => blocker.code)),
    warningCodes: sortedUnique(draft.warnings.map(warning => warning.code)),
  }
}

export function selectInvoiceIssueDrafts(
  response: BillingDraftResponse,
  requestedContractIds?: string[],
): BillingDraftInvoice[] {
  if (!requestedContractIds) return [...response.drafts]
  const requested = new Set(requestedContractIds)
  const available = new Set(response.drafts.map(draft => draft.contractId))
  const missing = sortedUnique([...requested].filter(contractId => !available.has(contractId)))
  if (missing.length > 0) {
    throwValidationError('Không tìm thấy hợp đồng trong dự thảo kỳ này.', { contract_ids: missing })
  }
  return response.drafts.filter(draft => requested.has(draft.contractId))
}

export function buildInvoiceIssueSnapshot(
  response: BillingDraftResponse,
  contractIds: string[],
  dueDate: string | null,
): Record<string, unknown> {
  const targets = new Set(contractIds)
  const drafts = response.drafts
    .filter(draft => targets.has(draft.contractId))
    .sort((a, b) => a.contractId.localeCompare(b.contractId))
    .map(draft => ({
      contract_id: draft.contractId,
      room_id: draft.roomId,
      tenant_id: draft.tenantId,
      existing_invoice_id: draft.existingInvoiceId,
      existing_invoice_status: draft.existingInvoiceStatus,
      subtotal: draft.subtotalAmount,
      discount: draft.discountAmount,
      surcharge: draft.surchargeAmount,
      total: draft.totalAmount,
      blockers: draft.blockers.map(blocker => ({ code: blocker.code, meta: blocker.meta ?? {} })),
      warnings: draft.warnings.map(warning => ({ code: warning.code, meta: warning.meta ?? {} })),
      lines: [...draft.lines]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.chargeType.localeCompare(b.chargeType))
        .map(line => ({
          charge_type: line.chargeType,
          label: line.label,
          source_type: line.sourceType,
          source_id: line.sourceId,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          amount: line.amount,
          metadata: line.metadata,
          sort_order: line.sortOrder,
        })),
    }))

  return {
    period: {
      id: response.period.id,
      building_id: response.period.buildingId,
      status: response.period.status,
      updated_at: response.period.updatedAt,
    },
    due_date: dueDate,
    contract_ids: sortedUnique(contractIds),
    drafts,
  }
}

export function createInvoiceIssuePreview(
  response: BillingDraftResponse,
  requestedContractIds: string[] | undefined,
  dueDate: string | null,
): { preview: AiInvoiceIssuePreview; targetContractIds: string[] } {
  const selected = selectInvoiceIssueDrafts(response, requestedContractIds)
  const issuableRows = selected.filter(draft => draft.blockers.length === 0 && draft.existingInvoiceId === null)
  const blockedRows = selected.filter(draft => draft.blockers.length > 0)
  const alreadyIssuedRows = selected.filter(draft => draft.existingInvoiceId !== null)
  const targetContractIds = sortedUnique(issuableRows.map(draft => draft.contractId))
  const snapshot = buildInvoiceIssueSnapshot(response, targetContractIds, dueDate)
  const snapshotHash = hashAgentPayload(snapshot, {})

  return {
    targetContractIds,
    preview: {
      periodId: response.period.id,
      dueDate,
      requestedContractIds: sortedUnique(requestedContractIds ?? selected.map(draft => draft.contractId)),
      issuable: issuableRows.map(previewItem).sort((a, b) => a.contractId.localeCompare(b.contractId)),
      blocked: blockedRows.map(previewItem).sort((a, b) => a.contractId.localeCompare(b.contractId)),
      alreadyIssued: alreadyIssuedRows.map(previewItem).sort((a, b) => a.contractId.localeCompare(b.contractId)),
      issuableCount: issuableRows.length,
      blockedCount: blockedRows.length,
      alreadyIssuedCount: alreadyIssuedRows.length,
      totalAmount: issuableRows.reduce((total, draft) => total + draft.totalAmount, 0),
      snapshotHash,
    },
  }
}
