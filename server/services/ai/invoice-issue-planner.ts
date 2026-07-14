import type { H3Event } from 'h3'
import type { AiActionPlanDto, AiInvoiceIssuePreview } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { toAiActionPlanDto } from '~/utils/mappers/ai'
import type { AiToolPlanInvoiceIssueInput } from '~/utils/validators/ai'
import { can } from '../../utils/permissions'
import { BillingDraftService } from '../billing/drafts'
import { AiActionService } from './actions'
import { createInvoiceIssuePreview } from './invoice-issue-snapshot'

export type AiInvoiceIssuePlanResult =
  | { status: 'planned'; preview: AiInvoiceIssuePreview; actionPlan: AiActionPlanDto }
  | { status: 'preview_only'; preview: AiInvoiceIssuePreview }

export const AiInvoiceIssuePlanner = {
  async plan(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    input: AiToolPlanInvoiceIssueInput,
  ): Promise<AiInvoiceIssuePlanResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền phát hành hoá đơn')
    const draft = await BillingDraftService.calculateDraft(event, user, input.period_id)
    const dueDate = input.due_date ?? null
    const { preview, targetContractIds } = createInvoiceIssuePreview(
      draft,
      input.contract_ids,
      dueDate,
    )

    if (targetContractIds.length === 0) return { status: 'preview_only', preview }

    const monthLabel = `${String(draft.period.periodMonth).padStart(2, '0')}/${draft.period.periodYear}`
    const warnings = [
      ...(preview.blockedCount > 0 ? [`Loại ${preview.blockedCount} dự thảo đang có lỗi chặn.`] : []),
      ...(preview.alreadyIssuedCount > 0 ? [`Bỏ qua ${preview.alreadyIssuedCount} hợp đồng đã có hoá đơn.`] : []),
    ]
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: draft.period.buildingId,
      action_type: 'issue_invoices',
      title: `Phát hành ${preview.issuableCount} hoá đơn kỳ ${monthLabel}`,
      summary: `Phát hành ${preview.issuableCount} hoá đơn với tổng giá trị ${preview.totalAmount.toLocaleString('vi-VN')} ₫.`,
      normalized_payload: {
        period_id: draft.period.id,
        contract_ids: targetContractIds,
        due_date: dueDate,
        snapshot_hash: preview.snapshotHash,
      },
      preview: { ...preview },
      warnings,
      resource_versions: {
        period: draft.period.updatedAt,
        draft_snapshot: preview.snapshotHash,
      },
      expires_in_seconds: 900,
    })
    return { status: 'planned', preview, actionPlan: toAiActionPlanDto(plan) }
  },
}
