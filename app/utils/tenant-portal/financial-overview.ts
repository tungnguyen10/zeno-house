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
  const recent = [...invoices]
    .sort((left, right) => comparePeriod(right, left))
    .slice(0, limit)
    .sort(comparePeriod)
  const totalAmount = recent.reduce((sum, item) => sum + item.totalAmount, 0)
  const paidAmount = recent.reduce((sum, item) => sum + item.paidAmount, 0)

  return {
    invoices: recent,
    labels: recent.map(item =>
      `${String(item.periodMonth).padStart(2, '0')}/${String(item.periodYear).slice(-2)}`,
    ),
    totalAmounts: recent.map(item => item.totalAmount),
    paidAmounts: recent.map(item => item.paidAmount),
    averageMonthlyAmount: recent.length > 0
      ? Math.round(totalAmount / recent.length)
      : 0,
    paidRatio: totalAmount > 0
      ? Math.min(100, Math.max(0, Math.round((paidAmount / totalAmount) * 100)))
      : 0,
  }
}
