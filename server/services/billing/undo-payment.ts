import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Invoice } from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import type { InvoiceStatus } from '~/utils/constants/billing'
import { newCorrelationId } from '../../utils/billing/correlation'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { InvoicePaymentRepository } from '../../repositories/billing/payments'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingAuditService } from './audit'
import { BillingDisplayResolver } from './display'
import { assertBuildingScope } from '../../utils/scope'

export const UndoPaymentService = {
  /**
   * Undo a recorded payment by soft-deleting it, then recompute the invoice's
   * paid/balance/status from the remaining active payments and emit a
    * `payment.undone` audit event. Blocked when the period is closed.
   */
  async undoPayment(
    event: H3Event,
    user: AuthUser,
    invoiceId: string,
    paymentId: string,
    reason?: string | null,
  ): Promise<Invoice> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền hoàn tác thanh toán')

    const invoice = await InvoiceRepository.findByIdentifier(event, invoiceId)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')

    const payment = await InvoicePaymentRepository.findById(event, paymentId)
    if (!payment || payment.invoiceId !== invoice.id) throwNotFound('Không tìm thấy khoản thu')

    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')
    if (period.status === 'closed') throwConflict('Kỳ đã chốt — không thể hoàn tác thanh toán')

    await InvoicePaymentRepository.softDelete(event, payment.id, user.id ?? null, reason ?? null)

    // Recompute from the remaining active payments.
    const paid = await InvoicePaymentRepository.sumByInvoice(event, invoice.id)
    const balance = invoice.totalAmount - paid
    let status: InvoiceStatus
    let paidAt: string | null = null
    if (paid <= 0) {
      status = 'issued'
    }
    else if (balance <= 0) {
      status = 'paid'
      paidAt = invoice.paidAt
    }
    else {
      status = 'partial'
    }

    const updatedInvoice = await InvoiceRepository.updatePaymentTotals(
      event,
      invoice.id,
      paid,
      balance,
      status,
      paidAt,
    )

    await BillingAuditService.append(event, user, {
      billing_period_id: invoice.billingPeriodId,
      action: BILLING_AUDIT_ACTIONS.PAYMENT_UNDONE,
      entity_type: 'invoice',
      entity_id: invoice.id,
      correlation_id: newCorrelationId(),
      before_data: {
        paid_amount: invoice.paidAmount,
        balance_amount: invoice.balanceAmount,
        status: invoice.status,
      },
      after_data: {
        paid_amount: updatedInvoice.paidAmount,
        balance_amount: updatedInvoice.balanceAmount,
        status: updatedInvoice.status,
      },
      metadata: {
        payment_id: payment.id,
        amount: payment.amount,
        reason: reason ?? null,
      },
    })

    const [enriched] = await new BillingDisplayResolver(event).enrichInvoices([updatedInvoice])
    return enriched ?? updatedInvoice
  },
}
