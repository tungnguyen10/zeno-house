import type {
  BuildingInvoiceEmailSettings,
  InvoiceEmailDelivery,
} from '~/types/invoice-email'
import type {
  InvoiceEmailDeliverySource,
  InvoiceEmailDeliveryStatus,
} from '~/utils/constants/invoice-email'

export interface BuildingInvoiceEmailSettingsRow {
  building_id: string
  auto_send_enabled: boolean
  created_at: string | null
  updated_at: string | null
  updated_by: string | null
}

export interface InvoiceEmailDeliveryRow {
  id: string
  invoice_id: string
  building_id: string
  billing_period_id: string
  recipient_email: string | null
  source: string
  status: string
  provider_email_id: string | null
  idempotency_key: string
  attempt_count: number
  next_attempt_at: string | null
  lease_expires_at: string | null
  last_error_code: string | null
  last_error_message: string | null
  accepted_at: string | null
  delivered_at: string | null
  failed_at: string | null
  bounced_at: string | null
  complained_at: string | null
  skipped_at: string | null
  provider_event_at: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export function mapBuildingInvoiceEmailSettings(
  buildingId: string,
  row: BuildingInvoiceEmailSettingsRow | null,
  featureAvailable: boolean,
): BuildingInvoiceEmailSettings {
  return {
    buildingId,
    autoSendEnabled: row?.auto_send_enabled ?? false,
    featureAvailable,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  }
}

export function mapInvoiceEmailDelivery(
  row: InvoiceEmailDeliveryRow,
): InvoiceEmailDelivery {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    buildingId: row.building_id,
    billingPeriodId: row.billing_period_id,
    recipientEmail: row.recipient_email,
    source: row.source as InvoiceEmailDeliverySource,
    status: row.status as InvoiceEmailDeliveryStatus,
    providerEmailId: row.provider_email_id,
    attemptCount: row.attempt_count,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    acceptedAt: row.accepted_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    bouncedAt: row.bounced_at,
    complainedAt: row.complained_at,
    skippedAt: row.skipped_at,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}
