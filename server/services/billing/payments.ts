import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Invoice, InvoicePayment } from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import type {
  BulkPaymentsBodyInput,
  InvoicePaymentCreateInput,
} from '~/utils/validators/billing'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { InvoicePaymentRepository } from '../../repositories/billing/payments'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingAuditService } from './audit'
import { BillingPeriodService } from './periods'
import { BillingDisplayResolver } from './display'
import { calculateInvoicePaymentStatus } from './rules'

interface BulkPaymentRollback {
  paymentId: string
  invoiceId: string
  beforePaid: number
  beforeBalance: number
  beforeStatus: Invoice['status']
  beforePaidAt: string | null
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

    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
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
   * Record a batch of payments transactionally. All-or-nothing: any failure
   * rolls back already-inserted payments and restores the affected invoice
   * totals to their pre-batch state. A single `payments.bulk_recorded` audit
   * event is appended on success.
   */
  async recordBatch(
    event: H3Event,
    user: AuthUser,
    body: BulkPaymentsBodyInput,
  ): Promise<BulkPaymentsResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền ghi nhận thanh toán')

    const items = body.payments
    if (items.length === 0) throwValidationError('Cần ít nhất 1 dòng thanh toán')

    const rollback: BulkPaymentRollback[] = []
    const created: InvoicePayment[] = []
    const invoiceIds = new Set<string>()
    const periodIds = new Set<string>()
    let totalAmount = 0

    const undo = async () => {
      for (const entry of [...rollback].reverse()) {
        try {
          await InvoiceRepository.updatePaymentTotals(
            event,
            entry.invoiceId,
            entry.beforePaid,
            entry.beforeBalance,
            entry.beforeStatus,
            entry.beforePaidAt,
          )
        }
        catch {
          // best-effort
        }
        try {
          await InvoicePaymentRepository.deleteById(event, entry.paymentId)
        }
        catch {
          // best-effort
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      try {
        const invoice = await InvoiceRepository.findById(event, item.invoice_id)
        if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
        if (invoice.status === 'void') throwConflict('Hoá đơn đã huỷ — không thể ghi nhận thanh toán')
        if (item.amount > invoice.balanceAmount) {
          throwValidationError('Số tiền vượt quá công nợ còn lại của hoá đơn', {
            invoice_id: invoice.id,
            balance: invoice.balanceAmount,
            amount: item.amount,
          })
        }
        const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
        if (period?.status === 'closed') throwConflict('Kỳ đã chốt — không thể ghi nhận thanh toán mới')
        periodIds.add(invoice.billingPeriodId)

        const composedNote = item.reference?.trim()
          ? `[${item.reference.trim()}] ${item.note?.trim() ?? ''}`.trim()
          : (item.note?.trim() || null)

        const paymentInput: InvoicePaymentCreateInput = {
          amount: item.amount,
          paid_at: item.payment_date,
          payment_method: item.payment_method ?? null,
          note: composedNote || null,
        }

        const payment = await InvoicePaymentRepository.insert(
          event,
          item.invoice_id,
          user.id ?? null,
          paymentInput,
        )

        try {
          const next = calculateInvoicePaymentStatus(invoice, item.amount)
          const paidAt = next.balanceAmount <= 0 ? item.payment_date : null
          await InvoiceRepository.updatePaymentTotals(
            event,
            item.invoice_id,
            next.paidAmount,
            next.balanceAmount,
            next.status,
            paidAt,
          )
          rollback.push({
            paymentId: payment.id,
            invoiceId: item.invoice_id,
            beforePaid: invoice.paidAmount,
            beforeBalance: invoice.balanceAmount,
            beforeStatus: invoice.status,
            beforePaidAt: invoice.paidAt,
          })
          created.push(payment)
          invoiceIds.add(item.invoice_id)
          totalAmount += item.amount
        }
        catch (err) {
          await InvoicePaymentRepository.deleteById(event, payment.id).catch(() => {})
          throw err
        }
      }
      catch (err) {
        await undo()
        const e = err as { data?: { error?: { message?: string } }; message?: string }
        const message = e.data?.error?.message ?? e.message ?? 'Lỗi ghi thanh toán'
        throw createError({
          statusCode: 409,
          data: {
            error: {
              code: 'CONFLICT',
              message: `Lỗi tại dòng ${i + 1}: ${message}`,
              details: { failed_index: i, failed_reason: message },
            },
          },
        })
      }
    }

    // Advance period status for any periods that were `issued` to `collecting`.
    for (const periodId of periodIds) {
      const period = await BillingPeriodRepository.findById(event, periodId)
      if (period && period.status === 'issued') {
        await BillingPeriodService.advanceStatus(event, user, periodId, 'collecting')
      }
    }

    const auditPeriodId = periodIds.size === 1 ? [...periodIds][0]! : null
    await BillingAuditService.append(event, user, {
      billing_period_id: auditPeriodId,
      action: BILLING_AUDIT_ACTIONS.PAYMENTS_BULK_RECORDED,
      entity_type: 'billing_period',
      entity_id: auditPeriodId,
      metadata: {
        count: created.length,
        total_amount: totalAmount,
        invoice_ids: [...invoiceIds],
      },
    })

    const resolver = new BillingDisplayResolver(event)
    const enriched = await resolver.enrichPayments(created)

    return {
      count: created.length,
      totalAmount,
      invoiceIds: [...invoiceIds],
      payments: enriched,
    }
  },
}
