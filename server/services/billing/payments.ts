import { getHeader, type H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { AuthUser } from '~/types/auth'
import type { Invoice, InvoicePayment } from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import type {
  BulkPaymentsBodyInput,
  InvoicePaymentCreateInput,
} from '~/utils/validators/billing'
import { mapInvoicePayment } from '~/utils/mappers/billing'
import { newCorrelationId } from '../../utils/billing/correlation'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { InvoicePaymentRepository } from '../../repositories/billing/payments'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingAuditService } from './audit'
import { BillingPeriodService } from './periods'
import { BillingDisplayResolver } from './display'
import { calculateInvoicePaymentStatus } from './rules'
import { assertBuildingScope } from '../../utils/scope'

interface BulkPaymentRpcErrorDetails {
  failed_index?: number
  failed_reason?: string
}

function parseBulkPaymentRpcDetails(raw: unknown): BulkPaymentRpcErrorDetails {
  if (typeof raw !== 'string' || raw.length === 0) return {}
  try {
    const parsed = JSON.parse(raw) as BulkPaymentRpcErrorDetails
    return parsed ?? {}
  }
  catch {
    return {}
  }
}

export interface BulkPaymentsResult {
  count: number
  totalAmount: number
  invoiceIds: string[]
  payments: InvoicePayment[]
}

export const InvoicePaymentService = {
  async list(event: H3Event, user: AuthUser, invoiceId: string): Promise<InvoicePayment[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem khoản thu')
    const invoice = await InvoiceRepository.findByIdentifier(event, invoiceId)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')
    const payments = await InvoicePaymentRepository.listByInvoice(event, invoice.id)
    return new BillingDisplayResolver(event).enrichPayments(payments)
  },

  /**
   * Record a payment against an invoice. Updates the invoice's
   * paid/balance/status atomically (best-effort: payment row first, then
   * invoice totals; if the totals update fails the payment row is removed).
   */
  async record(
    event: H3Event,
    user: AuthUser,
    invoiceId: string,
    input: InvoicePaymentCreateInput,
  ): Promise<{ payment: InvoicePayment; invoice: Invoice }> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền ghi nhận thanh toán')

    const invoice = await InvoiceRepository.findByIdentifier(event, invoiceId)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    if (invoice.status === 'void') throwConflict('Hoá đơn đã huỷ — không thể ghi nhận thanh toán')
    if (input.amount > invoice.balanceAmount) {
      throwValidationError('Số tiền vượt quá công nợ còn lại của hoá đơn', {
        balance: invoice.balanceAmount,
        amount: input.amount,
      })
    }
    const strictFull = getHeader(event, 'x-billing-strict-full') === 'true'
    if (strictFull && input.amount < invoice.balanceAmount) {
      throw createError({
        statusCode: 400,
        data: {
          error: {
            code: 'PARTIAL_PAYMENT_DISABLED',
            message: 'Luồng thu tiền mới yêu cầu thu đủ số còn lại của hoá đơn',
          },
        },
      })
    }

    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period?.status === 'closed') throwConflict('Kỳ đã chốt — không thể ghi nhận thanh toán mới')

    const payment = await InvoicePaymentRepository.insert(event, invoice.id, user.id ?? null, input)

    let updatedInvoice: Invoice
    try {
      const next = calculateInvoicePaymentStatus(invoice, input.amount)
      const paidAt = next.balanceAmount <= 0 ? input.paid_at : null
      updatedInvoice = await InvoiceRepository.updatePaymentTotals(
        event,
        invoice.id,
        next.paidAmount,
        next.balanceAmount,
        next.status,
        paidAt,
      )
    } catch (e) {
      // Best-effort rollback of the payment row
      await InvoicePaymentRepository.deleteById(event, payment.id)
      throw e
    }

    // Move period from issued -> collecting on first payment.
    if (period && period.status === 'issued') {
      await BillingPeriodService.advanceStatus(event, user, period.id, 'collecting')
    }

    await BillingAuditService.append(event, user, {
      billing_period_id: invoice.billingPeriodId,
      action: BILLING_AUDIT_ACTIONS.PAYMENT_RECORDED,
      entity_type: 'invoice_payment',
      entity_id: payment.id,
      before_data: { paid_amount: invoice.paidAmount, balance_amount: invoice.balanceAmount, status: invoice.status },
      after_data: { paid_amount: updatedInvoice.paidAmount, balance_amount: updatedInvoice.balanceAmount, status: updatedInvoice.status },
      metadata: {
        invoice_id: invoice.id,
        amount: payment.amount,
        paid_at: payment.paidAt,
        payment_method: payment.paymentMethod,
      },
    })

    const resolver = new BillingDisplayResolver(event)
    const [enrichedPayment] = await resolver.enrichPayments([payment])
    const [enrichedInvoice] = await resolver.enrichInvoices([updatedInvoice])
    return {
      payment: enrichedPayment ?? payment,
      invoice: enrichedInvoice ?? updatedInvoice,
    }
  },

  /**
   * Record a batch of payments transactionally.
   *
   * Delegates the whole write — payment inserts, invoice total recompute,
   * affected-period transitions (`issued -> collecting`), and the single
   * `payments.bulk_recorded` audit event — to the
   * `public.record_bulk_payments` PL/pgSQL function. The function raises
   * P0001 on the first failing row with `{ failed_index, failed_reason }` in
   * the exception DETAIL; we map that back into the existing CONFLICT
   * envelope so the API contract is unchanged.
   */
  async recordBatch(
    event: H3Event,
    user: AuthUser,
    body: BulkPaymentsBodyInput,
  ): Promise<BulkPaymentsResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền ghi nhận thanh toán')

    const items = body.payments
    if (items.length === 0) throwValidationError('Cần ít nhất 1 dòng thanh toán')

    const scopedPeriodIds = new Set<string>()
    for (const item of items) {
      const invoice = await InvoiceRepository.findByIdentifier(event, item.invoice_id)
      if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
      if (scopedPeriodIds.has(invoice.billingPeriodId)) continue
      const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
      if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
      await assertBuildingScope(event, user, period.buildingId, 'write')
      scopedPeriodIds.add(period.id)
    }

    const payload = items.map(item => ({
      invoice_id: item.invoice_id,
      amount: item.amount,
      payment_date: item.payment_date,
      payment_method: item.payment_method ?? null,
      note: item.note ?? null,
      reference: item.reference ?? null,
    }))

    const client = await serverSupabaseClient(event)
    const { data, error } = await client.rpc('record_bulk_payments', {
      p_actor_id: user.id ?? null,
      p_payments: payload,
      p_correlation_id: newCorrelationId(),
    })

    if (error) {
      const details = parseBulkPaymentRpcDetails((error as { details?: unknown }).details)
      const failedIndex = typeof details.failed_index === 'number' ? details.failed_index : 0
      const failedReason = details.failed_reason ?? error.message ?? 'Lỗi ghi thanh toán'
      throw createError({
        statusCode: 409,
        data: {
          error: {
            code: 'CONFLICT',
            message: `Lỗi tại dòng ${failedIndex + 1}: ${failedReason}`,
            details: { failed_index: failedIndex, failed_reason: failedReason },
          },
        },
      })
    }

    const inserted: InvoicePayment[] = ((data as Array<Record<string, unknown>> | null) ?? []).map(
      row => mapInvoicePayment(row as never),
    )
    const invoiceIds = [...new Set(inserted.map(p => p.invoiceId))]
    const totalAmount = inserted.reduce((sum, p) => sum + p.amount, 0)

    const resolver = new BillingDisplayResolver(event)
    const enriched = await resolver.enrichPayments(inserted)

    return {
      count: inserted.length,
      totalAmount,
      invoiceIds,
      payments: enriched,
    }
  },
}
