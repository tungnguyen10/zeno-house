import type { TenantInvoiceListItem } from '~/types/tenant-portal'

export interface TenantInvoiceYearGroup {
  year: number
  invoices: TenantInvoiceListItem[]
}

/** A displayed balance is payable only after issuance and before voiding. */
export function isPayableTenantInvoice(invoice: TenantInvoiceListItem): boolean {
  return ['issued', 'partial', 'overdue'].includes(invoice.status)
    && !invoice.voidedAt
    && invoice.balanceAmount > 0
}

/** Part-paid debt can be overdue too; the issued grace snapshot remains authoritative. */
export function isOverdueTenantInvoice(invoice: TenantInvoiceListItem, today: string): boolean {
  return isPayableTenantInvoice(invoice)
    && (invoice.status === 'overdue' || Boolean(invoice.overdueDate && invoice.overdueDate < today))
}

export function compareTenantInvoicePriority(
  left: TenantInvoiceListItem,
  right: TenantInvoiceListItem,
  today: string,
): number {
  const overdueFirst = Number(isOverdueTenantInvoice(right, today)) - Number(isOverdueTenantInvoice(left, today))
  if (overdueFirst) return overdueFirst

  // Known deadlines precede unscheduled legacy debt. Do not invent a due date.
  const deadlineOrder = (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31')
  return deadlineOrder
    || left.periodYear - right.periodYear
    || left.periodMonth - right.periodMonth
    || (left.issuedAt ?? '').localeCompare(right.issuedAt ?? '')
    || left.id.localeCompare(right.id)
}

export function groupTenantInvoicesByYear(
  invoices: TenantInvoiceListItem[],
): TenantInvoiceYearGroup[] {
  const groups: TenantInvoiceYearGroup[] = []
  const groupsByYear = new Map<number, TenantInvoiceYearGroup>()
  const orderedInvoices = invoices
    .map((invoice, originalIndex) => ({ invoice, originalIndex }))
    .sort((left, right) =>
      right.invoice.periodYear - left.invoice.periodYear
      || right.invoice.periodMonth - left.invoice.periodMonth
      || left.originalIndex - right.originalIndex,
    )
    .map(({ invoice }) => invoice)

  for (const invoice of orderedInvoices) {
    let group = groupsByYear.get(invoice.periodYear)

    if (!group) {
      group = { year: invoice.periodYear, invoices: [] }
      groupsByYear.set(invoice.periodYear, group)
      groups.push(group)
    }

    group.invoices.push(invoice)
  }

  return groups
}

export function tenantInvoicePaymentProgress(
  totalAmount: number,
  paidAmount: number,
): number {
  if (totalAmount <= 0) return 0

  const percentage = Math.round((paidAmount / totalAmount) * 100)
  return Math.min(100, Math.max(0, percentage))
}
