import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Invoice, InvoicePayment } from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import type { InvoicePaymentCreateInput } from '~/utils/validators/billing'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { InvoicePaymentRepository } from '../../repositories/billing/payments'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingAuditService } from './audit'
import { BillingPeriodService } from './periods'

export const InvoicePaymentService = {
  async list(event: H3Event, user: AuthUser, invoiceId: string): Promise<InvoicePayment[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem khoản thu')
    return InvoicePaymentRepository.listByInvoice(event, invoiceId)
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

    const invoice = await InvoiceRepository.findById(event, invoiceId)
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

    const payment = await InvoicePaymentRepository.insert(event, invoiceId, user.id ?? null, input)

    let updatedInvoice: Invoice
    try {
      const newPaid = invoice.paidAmount + input.amount
      const newBalance = invoice.totalAmount - newPaid
      let nextStatus: Invoice['status'] = invoice.status
      if (newBalance <= 0) nextStatus = 'paid'
      else if (newPaid > 0) nextStatus = 'partial'
      const paidAt = newBalance <= 0 ? input.paid_at : null
      updatedInvoice = await InvoiceRepository.updatePaymentTotals(
        event,
        invoiceId,
        newPaid,
        newBalance,
        nextStatus,
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
        invoice_id: invoiceId,
        amount: payment.amount,
        paid_at: payment.paidAt,
        payment_method: payment.paymentMethod,
      },
    })

    return { payment, invoice: updatedInvoice }
  },
}
