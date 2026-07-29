import type { TenantInvoiceListItem } from '~/types/tenant-portal'

export interface TenantInvoiceYearGroup {
  year: number
  invoices: TenantInvoiceListItem[]
}

export function groupTenantInvoicesByYear(
  invoices: TenantInvoiceListItem[],
): TenantInvoiceYearGroup[] {
  const groups: TenantInvoiceYearGroup[] = []
  const groupsByYear = new Map<number, TenantInvoiceYearGroup>()

  for (const invoice of invoices) {
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
