import type { H3Event } from 'h3'
import type { AiActionPlanDto } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { toAiActionPlanDto } from '~/utils/mappers/ai'
import type {
  AiToolPlanPaidInvoiceAdjustmentInput,
  AiToolPlanReissueInvoiceInput,
  AiToolPlanVoidInvoiceInput,
} from '~/utils/validators/ai'
import { BillingAuditRepository } from '../../repositories/billing/audit'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { can } from '../../utils/permissions'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import { BillingDraftService } from '../billing/drafts'
import { InvoiceService } from '../billing/invoices'
import { validateAdjustment } from '../billing/rules'
import { AiActionService } from './actions'
import { buildInvoiceIssueSnapshot } from './invoice-issue-snapshot'
import { hashAgentPayload } from '../../utils/ai'

async function correctionContext(event: H3Event, user: AuthUser, invoiceRef: string) {
  if (!can(user, 'billing.corrections')) throwForbidden('Không có quyền đính chính hoá đơn')
  const detail = await InvoiceService.getWithCharges(event, user, invoiceRef)
  const period = await BillingPeriodRepository.findById(event, detail.invoice.billingPeriodId)
  if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
  if (period.status === 'closed') throwConflict('Kỳ đã chốt — không thể đính chính hoá đơn trực tiếp')
  return { ...detail, period }
}

export const AiInvoiceCorrectionPlanner = {
  async planVoid(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    input: AiToolPlanVoidInvoiceInput,
  ): Promise<{ status: 'planned'; actionPlan: AiActionPlanDto }> {
    const { invoice, payments, period } = await correctionContext(event, user, input.invoice_ref)
    if (invoice.status === 'void') throwConflict('Hoá đơn đã được huỷ')
    if (invoice.paidAmount > 0 || payments.length > 0) {
      throwConflict('Hoá đơn đã có khoản thu. Hãy dùng điều chỉnh hoá đơn hoặc hoàn tác khoản thu một cách riêng biệt.')
    }
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: period.buildingId,
      action_type: 'void_invoice',
      title: `Huỷ hoá đơn ${invoice.invoiceCode}`,
      summary: `Huỷ hoá đơn ${invoice.invoiceCode}, giá trị ${invoice.totalAmount.toLocaleString('vi-VN')} ₫.`,
      normalized_payload: {
        invoice_id: invoice.id,
        reason: input.reason,
        expected_updated_at: invoice.updatedAt,
      },
      preview: {
        invoice_id: invoice.id,
        invoice_code: invoice.invoiceCode,
        status_before: invoice.status,
        status_after: 'void',
        total_amount: invoice.totalAmount,
        paid_amount: invoice.paidAmount,
        reason: input.reason,
      },
      warnings: [],
      resource_versions: { invoice: invoice.updatedAt, period: period.updatedAt },
      expires_in_seconds: 900,
    })
    return { status: 'planned', actionPlan: toAiActionPlanDto(plan) }
  },

  async planReissue(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    input: AiToolPlanReissueInvoiceInput,
  ): Promise<{ status: 'planned'; actionPlan: AiActionPlanDto }> {
    const { invoice, period } = await correctionContext(event, user, input.invoice_ref)
    if (invoice.status !== 'void') throwConflict('Chỉ có thể phát hành lại hoá đơn đã huỷ')
    const active = await InvoiceRepository.findActiveByPeriodContract(event, period.id, invoice.contractId)
    if (active) throwConflict('Đã có hoá đơn thay thế còn hiệu lực')

    const draftResponse = await BillingDraftService.calculateDraft(event, user, period.id)
    const draft = draftResponse.drafts.find(row => row.contractId === invoice.contractId)
    if (!draft) throwNotFound('Không tìm thấy dự thảo thay thế')
    if (draft.blockers.length > 0) throwConflict('Dự thảo thay thế còn lỗi chặn')
    const dueDate = input.due_date ?? null
    const snapshot = buildInvoiceIssueSnapshot(draftResponse, [invoice.contractId], dueDate)
    const snapshotHash = hashAgentPayload(snapshot, {})
    const correlationId = (await BillingAuditRepository.findLatestCorrelation(
      event,
      invoice.id,
      BILLING_AUDIT_ACTIONS.INVOICE_VOIDED,
    )) ?? crypto.randomUUID()
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: period.buildingId,
      action_type: 'reissue_invoice',
      title: `Phát hành lại ${invoice.invoiceCode}`,
      summary: `Tạo hoá đơn thay thế trị giá ${draft.totalAmount.toLocaleString('vi-VN')} ₫.`,
      normalized_payload: {
        invoice_id: invoice.id,
        reason: input.reason,
        due_date: dueDate,
        notes: input.notes ?? null,
        expected_updated_at: invoice.updatedAt,
        snapshot_hash: snapshotHash,
        correlation_id: correlationId,
      },
      preview: {
        voided_invoice_id: invoice.id,
        voided_invoice_code: invoice.invoiceCode,
        old_total_amount: invoice.totalAmount,
        new_total_amount: draft.totalAmount,
        due_date: dueDate,
        blocker_codes: [],
        warning_codes: draft.warnings.map(warning => warning.code),
        reason: input.reason,
      },
      warnings: draft.warnings.map(warning => warning.message),
      resource_versions: {
        invoice: invoice.updatedAt,
        period: period.updatedAt,
        draft_snapshot: snapshotHash,
      },
      expires_in_seconds: 900,
    })
    return { status: 'planned', actionPlan: toAiActionPlanDto(plan) }
  },

  async planPaidAdjustment(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    input: AiToolPlanPaidInvoiceAdjustmentInput,
  ): Promise<{ status: 'planned'; actionPlan: AiActionPlanDto }> {
    const { invoice, period } = await correctionContext(event, user, input.invoice_ref)
    if (invoice.status !== 'partial' && invoice.status !== 'paid') {
      throwConflict('Điều chỉnh này chỉ dùng cho hoá đơn đã thu một phần hoặc đã thanh toán.')
    }
    validateAdjustment({
      periodStatus: period.status,
      invoicePaidAmount: invoice.paidAmount,
      amount: input.amount,
      reason: input.reason,
    })
    if (input.reference_invoice_id) {
      await InvoiceService.getWithCharges(event, user, input.reference_invoice_id)
    }

    const totalAfter = invoice.totalAmount + input.amount
    if (totalAfter < 0) throwConflict('Điều chỉnh làm tổng hoá đơn nhỏ hơn 0')
    const balanceAfter = totalAfter - invoice.paidAmount
    const statusAfter = balanceAfter <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partial' : invoice.status
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: period.buildingId,
      action_type: 'add_invoice_adjustment',
      title: `Điều chỉnh hoá đơn ${invoice.invoiceCode}`,
      summary: `${input.amount > 0 ? 'Tăng' : 'Giảm'} ${Math.abs(input.amount).toLocaleString('vi-VN')} ₫ trên hoá đơn ${invoice.invoiceCode}.`,
      normalized_payload: {
        invoice_id: invoice.id,
        label: input.label,
        amount: input.amount,
        reason: input.reason,
        reference_invoice_id: input.reference_invoice_id ?? null,
        expected_updated_at: invoice.updatedAt,
      },
      preview: {
        invoice_id: invoice.id,
        invoice_code: invoice.invoiceCode,
        total_before: invoice.totalAmount,
        total_after: totalAfter,
        paid_amount: invoice.paidAmount,
        balance_before: invoice.balanceAmount,
        balance_after: balanceAfter,
        status_before: invoice.status,
        status_after: statusAfter,
        label: input.label,
        amount: input.amount,
        reason: input.reason,
        payment_mutation: false,
      },
      warnings: balanceAfter < 0 ? ['Hoá đơn sẽ có số dư âm; cần xử lý hoàn tiền ngoài thao tác này.'] : [],
      resource_versions: { invoice: invoice.updatedAt, period: period.updatedAt },
      expires_in_seconds: 900,
    })
    return { status: 'planned', actionPlan: toAiActionPlanDto(plan) }
  },
}
