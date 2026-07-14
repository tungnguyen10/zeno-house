import {
  aiInvoiceIssuePayloadSchema,
  aiPaidInvoiceAdjustmentPayloadSchema,
  aiReissueInvoicePayloadSchema,
  aiVoidInvoicePayloadSchema,
} from '~/utils/validators/ai'
import { hashAgentPayload, throwAgentError } from '../../utils/ai'
import { BillingDraftService } from '../billing/drafts'
import { InvoiceService } from '../billing/invoices'
import type { AiActionExecutor } from './executors'
import { buildInvoiceIssueSnapshot } from './invoice-issue-snapshot'

function invalidPayload(message: string, details: unknown): never {
  throwAgentError(422, 'VALIDATION_ERROR', message, {
    category: 'TOOL_VALIDATION', retryable: false, details,
  })
}

function stale(plan: { id: string; conversationId: string }, message: string): never {
  throwAgentError(409, 'CONFLICT', message, {
    category: 'OPTIMISTIC_LOCK_CONFLICT',
    retryable: true,
    actionPlanId: plan.id,
    conversationId: plan.conversationId,
  })
}

function parseIssue(payload: Record<string, unknown>) {
  const parsed = aiInvoiceIssuePayloadSchema.safeParse(payload)
  if (!parsed.success) invalidPayload('Dữ liệu phát hành hoá đơn không hợp lệ.', parsed.error.flatten())
  return parsed.data
}

function parseVoid(payload: Record<string, unknown>) {
  const parsed = aiVoidInvoicePayloadSchema.safeParse(payload)
  if (!parsed.success) invalidPayload('Dữ liệu huỷ hoá đơn không hợp lệ.', parsed.error.flatten())
  return parsed.data
}

function parseReissue(payload: Record<string, unknown>) {
  const parsed = aiReissueInvoicePayloadSchema.safeParse(payload)
  if (!parsed.success) invalidPayload('Dữ liệu phát hành lại không hợp lệ.', parsed.error.flatten())
  return parsed.data
}

function parseAdjustment(payload: Record<string, unknown>) {
  const parsed = aiPaidInvoiceAdjustmentPayloadSchema.safeParse(payload)
  if (!parsed.success) invalidPayload('Dữ liệu điều chỉnh hoá đơn không hợp lệ.', parsed.error.flatten())
  return parsed.data
}

export const ISSUE_INVOICES_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'billing.write',
  async revalidate({ event, user, plan }) {
    const payload = parseIssue(plan.normalizedPayload)
    const response = await BillingDraftService.calculateDraft(event, user, payload.period_id)
    const snapshot = buildInvoiceIssueSnapshot(response, payload.contract_ids, payload.due_date)
    const currentHash = hashAgentPayload(snapshot, {})
    if (currentHash !== payload.snapshot_hash || plan.resourceVersions.draft_snapshot !== currentHash) {
      stale(plan, 'Dự thảo phát hành đã thay đổi. Vui lòng tạo lại bản xem trước.')
    }
  },
  async execute({ event, user, plan, idempotencyKey }) {
    const payload = parseIssue(plan.normalizedPayload)
    return InvoiceService.issueInvoices(event, user, payload.period_id, {
      contract_ids: payload.contract_ids,
      due_date: payload.due_date,
    }, { operationId: idempotencyKey })
  },
}

export const VOID_INVOICE_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'billing.corrections',
  async execute({ event, user, plan, idempotencyKey }) {
    const payload = parseVoid(plan.normalizedPayload)
    return InvoiceService.voidInvoice(event, user, payload.invoice_id, {
      reason: payload.reason,
      expected_updated_at: payload.expected_updated_at,
    }, { correlationId: idempotencyKey })
  },
}

export const REISSUE_INVOICE_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'billing.corrections',
  async revalidate({ event, user, plan }) {
    const payload = parseReissue(plan.normalizedPayload)
    const detail = await InvoiceService.getWithCharges(event, user, payload.invoice_id)
    const response = await BillingDraftService.calculateDraft(event, user, detail.invoice.billingPeriodId)
    const snapshot = buildInvoiceIssueSnapshot(response, [detail.invoice.contractId], payload.due_date)
    const currentHash = hashAgentPayload(snapshot, {})
    if (currentHash !== payload.snapshot_hash || plan.resourceVersions.draft_snapshot !== currentHash) {
      stale(plan, 'Dự thảo phát hành lại đã thay đổi. Vui lòng tạo lại kế hoạch.')
    }
  },
  async execute({ event, user, plan }) {
    const payload = parseReissue(plan.normalizedPayload)
    return InvoiceService.reissueInvoice(event, user, payload.invoice_id, {
      reason: payload.reason,
      due_date: payload.due_date,
      notes: payload.notes,
      expected_updated_at: payload.expected_updated_at,
    }, { correlationId: payload.correlation_id })
  },
}

export const ADD_INVOICE_ADJUSTMENT_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'billing.corrections',
  async execute({ event, user, plan, idempotencyKey }) {
    const payload = parseAdjustment(plan.normalizedPayload)
    return InvoiceService.addAdjustment(event, user, {
      target_invoice_id: payload.invoice_id,
      label: payload.label,
      amount: payload.amount,
      reason: payload.reason,
      reference_invoice_id: payload.reference_invoice_id,
      expected_updated_at: payload.expected_updated_at,
    }, { correlationId: idempotencyKey })
  },
}
