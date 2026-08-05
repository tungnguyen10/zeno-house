import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  BillingDraftInvoice,
  BillingInvoiceIssuePreview,
  InvoiceDocumentItem,
  IssueInvoicesResult,
} from '~/types/billing'
import type {
  IssueInvoicesInput,
  IssueInvoicesPreviewInput,
} from '~/utils/validators/billing'
import type { BuildingInvoiceProfileRow } from '~/utils/mappers/building-invoice-profile'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'
import { newCorrelationId } from '../../utils/billing/correlation'
import { can } from '../../utils/permissions'
import { BillingDraftService } from './drafts'
import { InvoiceService } from './invoices'
import {
  createInvoiceIssuePreview,
  selectInvoiceIssueDrafts,
  type InvoiceIssueProfileFingerprint,
} from './invoice-issue-snapshot'

const DRAFT_INVOICE_CODE = 'MÃ CẤP KHI PHÁT HÀNH'

function profileFingerprint(row: BuildingInvoiceProfileRow | null): InvoiceIssueProfileFingerprint | null {
  if (!row) return null
  return {
    updatedAt: row.updated_at,
    bankName: row.bank_name,
    accountHolder: row.account_holder,
    accountNumber: row.account_number,
    transferContentTemplate: row.transfer_content_template,
    qrImagePath: row.qr_image_path,
    logoImagePath: row.logo_image_path,
  }
}

function renderTransferContent(
  template: string,
  tokens: { buildingCode: string, roomNumber: string, period: string },
): string {
  return template
    .replaceAll('{building_code}', tokens.buildingCode)
    .replaceAll('{room_number}', tokens.roomNumber)
    .replaceAll('{invoice_code}', DRAFT_INVOICE_CODE)
    .replaceAll('{period}', tokens.period)
}

function exclusion(draft: BillingDraftInvoice) {
  if (draft.existingInvoiceId) {
    return {
      contractId: draft.contractId,
      roomNumber: draft.roomNumber,
      tenantName: draft.tenantName,
      reason: 'already_issued' as const,
      messages: ['Hợp đồng đã có hoá đơn trong kỳ này'],
    }
  }
  return {
    contractId: draft.contractId,
    roomNumber: draft.roomNumber,
    tenantName: draft.tenantName,
    reason: 'blocked' as const,
    messages: draft.blockers.map(blocker => blocker.message),
  }
}

async function loadIssueState(event: H3Event, user: AuthUser, periodId: string) {
  if (!can(user, 'billing.write')) throwForbidden('Không có quyền phát hành hoá đơn')
  const draftResponse = await BillingDraftService.calculateDraft(event, user, periodId)
  if (draftResponse.period.status === 'closed') {
    throwConflict('Kỳ đã chốt — không thể phát hành thêm hoá đơn')
  }
  const [building, profile] = await Promise.all([
    BuildingRepository.findById(event, draftResponse.period.buildingId),
    BuildingInvoiceProfileRepository.findByBuildingId(event, draftResponse.period.buildingId),
  ])
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return { draftResponse, building, profile }
}

async function buildDocuments(
  event: H3Event,
  state: Awaited<ReturnType<typeof loadIssueState>>,
  drafts: BillingDraftInvoice[],
  dueDate: string,
): Promise<InvoiceDocumentItem[]> {
  const { draftResponse, building, profile } = state
  const periodLabel = `${String(draftResponse.period.periodMonth).padStart(2, '0')}/${draftResponse.period.periodYear}`
  const [qrImageUrl, logoImageUrl] = profile
    ? await Promise.all([
        BuildingInvoiceProfileRepository.signAsset(event, profile.qr_image_path),
        profile.logo_image_path
          ? BuildingInvoiceProfileRepository.signAsset(event, profile.logo_image_path)
          : Promise.resolve(null),
      ])
    : [null, null]

  return drafts.map((draft): InvoiceDocumentItem => ({
    mode: 'draft',
    key: draft.contractId,
    invoiceCode: null,
    status: 'draft',
    roomNumber: draft.roomNumber,
    tenantName: draft.tenantName,
    issuedAt: new Date().toISOString(),
    dueDate,
    totalAmount: draft.totalAmount,
    paidAmount: 0,
    balanceAmount: draft.totalAmount,
    charges: draft.lines.map((line, index) => ({
      key: `${draft.contractId}:${line.sortOrder}:${index}`,
      chargeType: line.chargeType,
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
      metadata: line.metadata,
      sortOrder: line.sortOrder,
    })),
    invoiceProfile: profile
      ? {
          bankName: profile.bank_name,
          accountHolder: profile.account_holder,
          accountNumber: profile.account_number,
          transferContent: renderTransferContent(profile.transfer_content_template, {
            buildingCode: building.code,
            roomNumber: draft.roomNumber ?? '',
            period: periodLabel,
          }),
          qrImageUrl,
          logoImageUrl,
          snapshottedAt: profile.updated_at ?? '',
        }
      : null,
    period: draftResponse.period,
    building: {
      id: building.id,
      name: building.name,
      address: building.address,
    },
    warnings: draft.warnings,
  }))
}

export const BillingInvoiceIssueService = {
  async preview(
    event: H3Event,
    user: AuthUser,
    periodId: string,
    input: IssueInvoicesPreviewInput,
  ): Promise<BillingInvoiceIssuePreview> {
    const state = await loadIssueState(event, user, periodId)
    const fingerprint = profileFingerprint(state.profile)
    const { preview, targetContractIds } = createInvoiceIssuePreview(
      state.draftResponse,
      input.contract_ids,
      input.due_date,
      fingerprint,
    )
    const selected = selectInvoiceIssueDrafts(state.draftResponse, input.contract_ids)
    const issuableDrafts = selected.filter(draft => targetContractIds.includes(draft.contractId))
    const excludedDrafts = selected.filter(draft => !targetContractIds.includes(draft.contractId))

    return {
      periodId,
      dueDate: input.due_date,
      operationId: newCorrelationId(),
      snapshotHash: preview.snapshotHash,
      issuableCount: preview.issuableCount,
      blockedCount: preview.blockedCount,
      alreadyIssuedCount: preview.alreadyIssuedCount,
      totalAmount: preview.totalAmount,
      items: await buildDocuments(event, state, issuableDrafts, input.due_date),
      exclusions: excludedDrafts.map(exclusion),
    }
  },

  async confirm(
    event: H3Event,
    user: AuthUser,
    periodId: string,
    input: IssueInvoicesInput,
  ): Promise<IssueInvoicesResult> {
    const replay = await InvoiceService.findIssueReplay(event, user, periodId, input.operation_id)
    if (replay) return replay
    const state = await loadIssueState(event, user, periodId)
    const { preview, targetContractIds } = createInvoiceIssuePreview(
      state.draftResponse,
      input.contract_ids,
      input.due_date,
      profileFingerprint(state.profile),
    )
    if (preview.snapshotHash !== input.snapshot_hash) {
      throwConflict('Bản xem trước đã thay đổi. Vui lòng tải lại trước khi phát hành.', {
        reason: 'STALE_ISSUE_PREVIEW',
      })
    }

    return InvoiceService.issueInvoices(event, user, periodId, {
      contract_ids: targetContractIds,
      due_date: input.due_date,
    }, {
      operationId: input.operation_id,
      draftResponse: state.draftResponse,
    })
  },
}
