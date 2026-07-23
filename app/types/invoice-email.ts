import type {
  InvoiceEmailDeliverySource,
  InvoiceEmailDeliveryStatus,
} from '~/utils/constants/invoice-email'

export interface BuildingInvoiceEmailSettings {
  buildingId: string
  autoSendEnabled: boolean
  featureAvailable: boolean
  createdAt: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface InvoiceEmailDelivery {
  id: string
  invoiceId: string
  buildingId: string
  billingPeriodId: string
  recipientEmail: string | null
  source: InvoiceEmailDeliverySource
  status: InvoiceEmailDeliveryStatus
  providerEmailId: string | null
  attemptCount: number
  lastErrorCode: string | null
  lastErrorMessage: string | null
  acceptedAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  bouncedAt: string | null
  complainedAt: string | null
  skippedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type InvoiceEmailEnqueueResultStatus =
  | 'queued'
  | 'already_queued'
  | 'skipped'
  | 'failed'

export interface InvoiceEmailEnqueueItemResult {
  invoiceIdentifier: string
  invoiceId: string | null
  status: InvoiceEmailEnqueueResultStatus
  delivery: InvoiceEmailDelivery | null
  reason: string | null
}

export interface InvoiceEmailEnqueueResult {
  results: InvoiceEmailEnqueueItemResult[]
}
