import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  Invoice,
  InvoiceCharge,
  InvoiceWithCharges,
  IssueInvoicesResult,
} from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import type {
  AdjustmentChargeInput,
  IssueInvoicesInput,
  ReissueInvoiceInput,
  VoidInvoiceInput,
} from '~/utils/validators/billing'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { InvoicePaymentRepository } from '../../repositories/billing/payments'
import { assertReason } from '../../utils/billing/reason'
import { newCorrelationId } from '../../utils/billing/correlation'
import { BillingAuditService } from './audit'
import { BillingAuditRepository } from '../../repositories/billing/audit'
import { BillingDraftService } from './drafts'
import { BillingDisplayResolver } from './display'
import { validateAdjustment } from './rules'
import { assertBuildingScope } from '../../utils/scope'

export const InvoiceService = {
  async list(event: H3Event, user: AuthUser, billingPeriodId: string): Promise<Invoice[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem hoá đơn')
    const period = await BillingPeriodRepository.findById(event, billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')
    const invoices = await InvoiceRepository.listByPeriod(event, billingPeriodId)
    return new BillingDisplayResolver(event).enrichInvoices(invoices)
  },

  async getWithCharges(
    event: H3Event,
    user: AuthUser,
    invoiceId: string,
  ): Promise<InvoiceWithCharges> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem hoá đơn')
    const invoice = await InvoiceRepository.findByIdentifier(event, invoiceId)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')
    const charges = await InvoiceRepository.listCharges(event, invoice.id)
    const payments = await InvoicePaymentRepository.listByInvoice(event, invoice.id)
    const resolver = new BillingDisplayResolver(event)
    const [enrichedInvoice] = await resolver.enrichInvoices([invoice])
    return {
      invoice: enrichedInvoice ?? invoice,
      charges,
      payments: await resolver.enrichPayments(payments),
    }
  },

  /**
   * Issue invoices for all issuable drafts in a period. Recomputes the draft
   * server-side first so the invoice snapshot reflects fresh data and any
   * blockers are re-checked. Skips contracts that have an existing non-void
   * invoice in the period.
   *
   * The DB write is delegated to the `public.issue_period_invoices` PL/pgSQL
   * function so all invoices + charges + invoice-code allocation + period
   * status transition + audit events commit in a single transaction. Any
   * failure aborts the entire batch (no partial commits).
   */
  async issueInvoices(
    event: H3Event,
    user: AuthUser,
    periodId: string,
    input: IssueInvoicesInput,
    operation: { operationId?: string } = {},
  ): Promise<IssueInvoicesResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền phát hành hoá đơn')

    const period = await BillingPeriodRepository.findById(event, periodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period.status === 'closed') throwConflict('Kỳ đã chốt — không thể phát hành thêm hoá đơn')

    const draftResp = await BillingDraftService.calculateDraft(event, user, periodId)

    const targetContractIds = input.contract_ids ? new Set(input.contract_ids) : null
    const candidates = draftResp.drafts.filter(d =>
      (targetContractIds === null || targetContractIds.has(d.contractId))
      && d.blockers.length === 0
      && d.existingInvoiceId === null,
    )

    if (candidates.length === 0) {
      await BillingAuditService.append(event, user, {
        billing_period_id: period.id,
        action: BILLING_AUDIT_ACTIONS.ISSUE_ATTEMPTED,
        entity_type: 'billing_period',
        entity_id: period.id,
        metadata: {
          requested_contract_ids: input.contract_ids ?? null,
          blocked_count: draftResp.totals.blockedDraftCount,
          issuable_count: draftResp.totals.issuableDraftCount,
          issued: 0,
        },
      })
      return { issuedCount: 0, invoices: [] }
    }

    const issuedAt = new Date().toISOString()
    const draftsPayload = candidates.map(draft => ({
      contract_id: draft.contractId,
      room_id: draft.roomId,
      tenant_id: draft.tenantId,
      subtotal: draft.subtotalAmount,
      discount: draft.discountAmount,
      surcharge: draft.surchargeAmount,
      total: draft.totalAmount,
      notes: null,
      lines: draft.lines.map((l, idx) => ({
        charge_type: l.chargeType,
        label: l.label,
        source_type: l.sourceType,
        source_id: l.sourceId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        amount: l.amount,
        metadata: l.metadata ?? {},
        sort_order: l.sortOrder ?? idx,
      })),
    }))

    const issuedInvoices = await InvoiceRepository.issuePeriodWithAudit(event, {
      periodId: period.id,
      actorId: user.id ?? null,
      dueDate: input.due_date ?? null,
      issuedAt,
      requestedContractIds: input.contract_ids ?? null,
      drafts: draftsPayload,
      operationId: operation.operationId ?? newCorrelationId(),
    })

    return {
      issuedCount: issuedInvoices.length,
      invoices: await new BillingDisplayResolver(event).enrichInvoices(issuedInvoices),
    }
  },

  /**
   * Void an issued, unpaid invoice with reason. Returns the voided invoice.
   * Blocked when the invoice already has any payment.
   */
  async voidInvoice(
    event: H3Event,
    user: AuthUser,
    invoiceId: string,
    input: VoidInvoiceInput,
    operation: { correlationId?: string } = {},
  ): Promise<Invoice> {
    if (!can(user, 'billing.corrections')) throwForbidden('Không có quyền huỷ hoá đơn')
    const reason = assertReason(input.reason, 10)

    const invoice = await InvoiceRepository.findByIdentifier(event, invoiceId)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    if (invoice.status === 'void') throwConflict('Hoá đơn đã được huỷ trước đó')
    if (invoice.paidAmount > 0) {
      throwConflict('Hoá đơn đã thu một phần — cần dùng điều chỉnh thay vì huỷ')
    }

    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period?.status === 'closed') throwConflict('Kỳ đã chốt — không thể huỷ hoá đơn trực tiếp')

    const voided = await InvoiceRepository.voidWithAudit(event, {
      invoiceId: invoice.id,
      expectedUpdatedAt: input.expected_updated_at,
      actorId: user.id ?? null,
      reason,
      correlationId: operation.correlationId ?? newCorrelationId(),
    })

    const [enriched] = await new BillingDisplayResolver(event).enrichInvoices([voided])
    return enriched ?? voided
  },

  /**
   * Reissue a replacement invoice for a previously voided one. The new
   * invoice is computed from a fresh draft for the same contract+period and
   * linked back to the voided invoice via `supersedes_invoice_id`.
   */
  async reissueInvoice(
    event: H3Event,
    user: AuthUser,
    voidedInvoiceId: string,
    input: ReissueInvoiceInput,
    operation: { correlationId?: string } = {},
  ): Promise<Invoice> {
    if (!can(user, 'billing.corrections')) throwForbidden('Không có quyền phát hành lại hoá đơn')
    const reason = assertReason(input.reason, 10)

    const voided = await InvoiceRepository.findByIdentifier(event, voidedInvoiceId)
    if (!voided) throwNotFound('Không tìm thấy hoá đơn cần phát hành lại')
    if (voided.status !== 'void') throwConflict('Chỉ có thể phát hành lại hoá đơn đã huỷ')

    const period = await BillingPeriodRepository.findById(event, voided.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành của hoá đơn')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period.status === 'closed') throwConflict('Kỳ đã chốt — không thể phát hành lại')

    // Ensure no other active invoice already exists for this contract in this period.
    const existing = await InvoiceRepository.findActiveByPeriodContract(event, period.id, voided.contractId)
    if (existing) throwConflict('Đã có hoá đơn còn hiệu lực cho hợp đồng trong kỳ này')

    const draftResp = await BillingDraftService.calculateDraft(event, user, period.id)
    const draft = draftResp.drafts.find(d => d.contractId === voided.contractId)
    if (!draft) throwNotFound('Không tìm thấy dữ liệu dự thảo cho hợp đồng')
    if (draft.blockers.length > 0) {
      throwConflict('Còn cảnh báo chặn — không thể phát hành lại')
    }

    // Inherit the void event's correlation so void+reissue group together in
    // the audit drawer; fall back to a fresh id for legacy voids without one.
    const correlationId =
      operation.correlationId ?? (await BillingAuditRepository.findLatestCorrelation(
        event,
        voided.id,
        BILLING_AUDIT_ACTIONS.INVOICE_VOIDED,
      )) ?? newCorrelationId()

    const invoice = await InvoiceRepository.reissueWithAudit(event, {
      invoiceId: voided.id,
      expectedUpdatedAt: input.expected_updated_at,
      actorId: user.id ?? null,
      dueDate: input.due_date ?? null,
      issuedAt: new Date().toISOString(),
      notes: input.notes ?? null,
      reason,
      correlationId,
      draft: {
        contract_id: draft.contractId,
        room_id: draft.roomId,
        tenant_id: draft.tenantId,
        subtotal: draft.subtotalAmount,
        discount: draft.discountAmount,
        surcharge: draft.surchargeAmount,
        total: draft.totalAmount,
        lines: draft.lines.map(l => ({
          charge_type: l.chargeType,
          label: l.label,
          source_type: l.sourceType,
          source_id: l.sourceId,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          amount: l.amount,
          metadata: l.metadata,
          sort_order: l.sortOrder,
        })),
      },
    })

    const [enriched] = await new BillingDisplayResolver(event).enrichInvoices([invoice])
    return enriched ?? invoice
  },

  /**
   * Add an adjustment line to a target invoice. Used when the original
   * invoice is already paid (in part or full) or its period is closed and
   * voiding/reissuing is not appropriate.
   *
   * Adjustment amount can be positive (additional charge) or negative
   * (credit). Updates the target invoice totals/balance/status accordingly.
   */
  async addAdjustment(
    event: H3Event,
    user: AuthUser,
    input: AdjustmentChargeInput,
    operation: { correlationId?: string } = {},
  ): Promise<{ invoice: Invoice; charge: InvoiceCharge }> {
    if (!can(user, 'billing.corrections')) throwForbidden('Không có quyền tạo điều chỉnh')

    const target = await InvoiceRepository.findByIdentifier(event, input.target_invoice_id)
    if (!target) throwNotFound('Không tìm thấy hoá đơn đích')
    if (target.status === 'void') throwConflict('Hoá đơn đã huỷ — không thể thêm điều chỉnh')

    const period = await BillingPeriodRepository.findById(event, target.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    validateAdjustment({
      periodStatus: period?.status,
      invoicePaidAmount: target.paidAmount,
      amount: input.amount,
      reason: input.reason,
    })

    const { invoice: updated, charge } = await InvoiceRepository.addAdjustmentWithAudit(event, {
      invoiceId: target.id,
      expectedUpdatedAt: input.expected_updated_at,
      actorId: user.id ?? null,
      label: input.label,
      amount: input.amount,
      reason: input.reason,
      referenceInvoiceId: input.reference_invoice_id ?? null,
      correlationId: operation.correlationId ?? newCorrelationId(),
    })

    const [enriched] = await new BillingDisplayResolver(event).enrichInvoices([updated])
    return { invoice: enriched ?? updated, charge }
  },
}
