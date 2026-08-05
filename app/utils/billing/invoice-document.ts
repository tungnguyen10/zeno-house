import type { InvoiceDocumentItem, InvoicePrintItem } from '~/types/billing'

export function toIssuedInvoiceDocument(item: InvoicePrintItem): InvoiceDocumentItem {
  return {
    mode: 'issued',
    key: item.invoice.id,
    invoiceCode: item.invoice.invoiceCode,
    status: item.invoice.status,
    roomNumber: item.invoice.roomNumber ?? null,
    tenantName: item.invoice.tenantName ?? null,
    issuedAt: item.invoice.issuedAt,
    dueDate: item.invoice.dueDate,
    totalAmount: item.invoice.totalAmount,
    paidAmount: item.invoice.paidAmount,
    balanceAmount: item.invoice.balanceAmount,
    charges: item.charges.map(charge => ({
      key: charge.id,
      chargeType: charge.chargeType,
      label: charge.label,
      quantity: charge.quantity,
      unitPrice: charge.unitPrice,
      amount: charge.amount,
      metadata: charge.metadata,
      sortOrder: charge.sortOrder,
    })),
    invoiceProfile: item.invoiceProfile,
    period: item.period,
    building: item.building,
    warnings: [],
  }
}
