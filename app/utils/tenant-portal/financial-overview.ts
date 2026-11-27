import type { TenantInvoiceListItem } from '~/types/tenant-portal'

export interface PortalFinancialOverview {
  invoices: TenantInvoiceListItem[]
  labels: string[]
  totalAmounts: number[]
  paidAmounts: number[]
  averageMonthlyAmount: number
  paidRatio: number
}

export function buildPortalFinancialOverview(
  invoices: TenantInvoiceListItem[],
  limit = 6,
): PortalFinancialOverview {
  const comparePeriod = (left: TenantInvoiceListItem, right: TenantInvoiceListItem) =>
    left.periodYear - right.periodYear || left.periodMonth - right.periodMonth
  const validInvoices = invoices.filter(invoice => invoice.status !== 'void'
    && invoice.status !== 'draft' && !invoice.voidedAt)
  const monthKeys = [...new Set(validInvoices
    .map(invoice => invoice.periodYear * 12 + invoice.periodMonth))]
    .sort((left, right) => right - left)
    .slice(0, Math.max(0, Math.floor(limit)))
  const includedMonths = new Set(monthKeys)
  const recent = validInvoices
    .filter(invoice => includedMonths.has(invoice.periodYear * 12 + invoice.periodMonth))
    .sort(comparePeriod)
  const months = monthKeys.reverse().map(key => {
    const rows = recent.filter(invoice => invoice.periodYear * 12 + invoice.periodMonth === key)
    return {
      invoice: rows[0]!,
      totalAmount: rows.reduce((sum, item) => sum + item.totalAmount, 0),
      paidAmount: rows.reduce((sum, item) => sum + item.paidAmount, 0),
    }
  })
  const totalAmount = recent.reduce((sum, item) => sum + item.totalAmount, 0)
  const paidAmount = recent.reduce((sum, item) => sum + item.paidAmount, 0)

  return {
    invoices: recent,
    labels: months.map(({ invoice: item }) =>
      `${String(item.periodMonth).padStart(2, '0')}/${String(item.periodYear).slice(-2)}`,
    ),
    totalAmounts: months.map(item => item.totalAmount),
    paidAmounts: months.map(item => item.paidAmount),
    averageMonthlyAmount: months.length > 0
      ? Math.round(totalAmount / months.length)
      : 0,
    paidRatio: totalAmount > 0
      ? Math.min(100, Math.max(0, Math.round((paidAmount / totalAmount) * 100)))
      : 0,
  }
}
