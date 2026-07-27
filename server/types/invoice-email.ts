import type { ChargeType, InvoiceStatus } from '~/utils/constants/billing'

export interface InvoiceDocumentCharge {
  chargeType: ChargeType
  label: string
  quantity: number
  unitPrice: number
  amount: number
  metadata: Record<string, unknown>
}

export interface InvoiceDocumentPaymentProfile {
  bankName: string
  accountHolder: string
  accountNumber: string
  transferContent: string
  qrImagePath: string
  logoImagePath: string | null
  snapshottedAt: string
}

/**
 * Server-only read model shared by the HTML and PDF renderers.
 * Private Storage paths deliberately never cross an API boundary.
 */
export interface InvoiceDocumentData {
  invoiceId: string
  invoiceCode: string
  status: InvoiceStatus
  issuedAt: string | null
  dueDate: string | null
  periodLabel: string
  buildingName: string
  buildingAddress: string
  roomNumber: string
  tenantName: string
  subtotalAmount: number
  discountAmount: number
  surchargeAmount: number
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  notes: string | null
  charges: InvoiceDocumentCharge[]
  paymentProfile: InvoiceDocumentPaymentProfile | null
}

export interface InvoiceDocumentImageAsset {
  data: Buffer
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  filename: string
  cid: string
}

export interface InvoiceDocumentAssets {
  font: Buffer
  qrImage: InvoiceDocumentImageAsset | null
  logoImage: InvoiceDocumentImageAsset | null
}
