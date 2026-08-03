import { aiInvoicePaymentPayloadSchema } from '~/utils/validators/ai'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { throwAgentError } from '../../utils/ai'
import { InvoicePaymentService } from '../billing/payments'
import type { AiActionExecutor } from './executors'
import { hashInvoicePaymentSnapshot } from './invoice-payment-snapshot'

function invalidPayload(details: unknown): never {
  throwAgentError(422, 'VALIDATION_ERROR', 'Dữ liệu ghi thu hoá đơn không hợp lệ.', {
    category: 'TOOL_VALIDATION', retryable: false, details,
  })
}

function stale(plan: { id: string; conversationId: string }): never {
  throwAgentError(409, 'CONFLICT', 'Dữ liệu hoá đơn đã thay đổi. Vui lòng tạo lại kế hoạch ghi thu.', {
    category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    actionPlanId: plan.id, conversationId: plan.conversationId,
  })
}

function parse(payload: Record<string, unknown>) {
  const parsed = aiInvoicePaymentPayloadSchema.safeParse(payload)
  if (!parsed.success) invalidPayload(parsed.error.flatten())
  return parsed.data
}

export const RECORD_INVOICE_PAYMENTS_EXECUTOR: AiActionExecutor = {
  requiredCapability: 'billing.write',
  async revalidate({ event, plan }) {
    const payload = parse(plan.normalizedPayload)
    const [period, invoices] = await Promise.all([
      BillingPeriodRepository.findById(event, payload.billing_period_id),
      InvoiceRepository.findManyByIdentifiers(event, payload.payments.map(payment => payment.invoice_id)),
    ])
    if (!period || period.status === 'closed' || invoices.length !== payload.payments.length) stale(plan)
    const invoiceById = new Map(invoices.map(invoice => [invoice.id, invoice]))
    for (const expected of payload.payments) {
      const invoice = invoiceById.get(expected.invoice_id)
      if (
        !invoice
        || invoice.billingPeriodId !== period.id
        || invoice.roomId !== expected.room_id
        || invoice.updatedAt !== expected.expected_updated_at
        || invoice.balanceAmount !== expected.expected_balance_amount
        || invoice.balanceAmount <= 0
        || !['issued', 'partial', 'overdue'].includes(invoice.status)
        || invoice.voidedAt !== null
      ) stale(plan)
    }
    const currentHash = hashInvoicePaymentSnapshot(period, invoices)
    if (currentHash !== payload.snapshot_hash || plan.resourceVersions.payment_snapshot !== currentHash) stale(plan)
  },
  async execute({ event, user, plan, idempotencyKey }) {
    const payload = parse(plan.normalizedPayload)
    return InvoicePaymentService.recordAiBatch(event, user, {
      periodId: payload.billing_period_id,
      payments: payload.payments.map(payment => ({
        invoiceId: payment.invoice_id,
        roomId: payment.room_id,
        expectedUpdatedAt: payment.expected_updated_at,
        expectedBalanceAmount: payment.expected_balance_amount,
      })),
      paymentDate: payload.payment_date,
      paymentMethod: payload.payment_method,
      note: payload.note,
      correlationId: idempotencyKey,
    })
  },
}
