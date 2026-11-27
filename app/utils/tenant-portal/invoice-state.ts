import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import { formatViDate } from '~/utils/format/time'

type InvoiceStateInput = Pick<TenantInvoiceListItem, 'status' | 'balanceAmount' | 'dueDate' | 'overdueDate'>

export function portalToday(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

/** A void invoice never requests payment, including historical non-zero balances. */
export function portalInvoiceState(invoice: InvoiceStateInput, today = portalToday()) {
  const outstanding = invoice.balanceAmount > 0
    && ['issued', 'partial', 'overdue'].includes(invoice.status)
  const overdue = outstanding && Boolean(invoice.overdueDate && today > invoice.overdueDate)
  const inGrace = outstanding && Boolean(
    invoice.dueDate && invoice.overdueDate && invoice.dueDate < today && today <= invoice.overdueDate,
  )
  return {
    outstanding,
    overdue,
    inGrace,
    dueLabel: invoice.dueDate ? formatViDate(invoice.dueDate) : 'Chưa có hạn thanh toán',
    graceLabel: inGrace ? `Đang trong thời gian gia hạn đến ${formatViDate(invoice.overdueDate)}` : null,
  }
}
