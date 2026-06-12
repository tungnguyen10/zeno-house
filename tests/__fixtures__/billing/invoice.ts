import type { Invoice, InvoicePayment } from '~/types/billing'

export function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-1',
    billingPeriodId: 'period-2026-05',
    contractId: 'contract-1',
    roomId: 'room-1',
    tenantId: 'tenant-1',
    status: 'issued',
    dueDate: '2026-06-05',
    issuedAt: '2026-05-31T00:00:00.000Z',
    paidAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    supersededByInvoiceId: null,
    supersedesInvoiceId: null,
    subtotalAmount: 3_500_000,
    discountAmount: 0,
    surchargeAmount: 0,
    totalAmount: 3_500_000,
    paidAmount: 0,
    balanceAmount: 3_500_000,
    notes: null,
    createdAt: '2026-05-31T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z',
    ...overrides,
  }
}

export function buildInvoicePayment(overrides: Partial<InvoicePayment> = {}): InvoicePayment {
  return {
    id: 'payment-1',
    invoiceId: 'invoice-1',
    amount: 1_000_000,
    paidAt: '2026-06-02',
    paymentMethod: 'cash',
    note: null,
    recordedBy: 'user-1',
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    ...overrides,
  }
}
