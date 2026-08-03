import type { BillingPeriod, Invoice } from '~/types/billing'
import { hashAgentPayload } from '../../utils/ai'

export function buildInvoicePaymentSnapshot(period: BillingPeriod, invoices: Invoice[]) {
  return {
    period: {
      id: period.id,
      building_id: period.buildingId,
      status: period.status,
      updated_at: period.updatedAt,
    },
    invoices: [...invoices]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(invoice => ({
        id: invoice.id,
        billing_period_id: invoice.billingPeriodId,
        room_id: invoice.roomId,
        status: invoice.status,
        voided_at: invoice.voidedAt,
        paid_amount: invoice.paidAmount,
        balance_amount: invoice.balanceAmount,
        updated_at: invoice.updatedAt,
      })),
  }
}

export function hashInvoicePaymentSnapshot(period: BillingPeriod, invoices: Invoice[]): string {
  return hashAgentPayload(buildInvoicePaymentSnapshot(period, invoices), {})
}
