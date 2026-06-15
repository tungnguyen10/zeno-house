import type { Tables } from '~/types/database.types'
import type {
  BillingPeriod,
  Invoice,
  InvoiceCharge,
  InvoicePayment,
  BillingUtilityUsage,
  BillingAuditEvent,
} from '~/types/billing'
import type {
  BillingPeriodStatus,
  InvoiceStatus,
  ChargeType,
  MeterType,
  UtilityUsageReason,
  BillingAuditEntityType,
} from '~/utils/constants/billing'

function asMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function mapBillingPeriod(row: Tables<'billing_periods'>): BillingPeriod {
  return {
    id: row.id,
    buildingId: row.building_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    status: row.status as BillingPeriodStatus,
    openedBy: row.opened_by,
    issuedAt: row.issued_at,
    closedAt: row.closed_at,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function mapInvoice(row: Tables<'invoices'>): Invoice {
  return {
    id: row.id,
    invoiceCode: row.invoice_code,
    billingPeriodId: row.billing_period_id,
    contractId: row.contract_id,
    roomId: row.room_id,
    tenantId: row.tenant_id,
    status: row.status as InvoiceStatus,
    dueDate: row.due_date,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    supersededByInvoiceId: row.superseded_by_invoice_id,
    supersedesInvoiceId: row.supersedes_invoice_id,
    subtotalAmount: Number(row.subtotal_amount),
    discountAmount: Number(row.discount_amount),
    surchargeAmount: Number(row.surcharge_amount),
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount),
    balanceAmount: Number(row.balance_amount),
    notes: row.notes,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function mapInvoiceCharge(row: Tables<'invoice_charges'>): InvoiceCharge {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    chargeType: row.charge_type as ChargeType,
    label: row.label,
    sourceType: row.source_type,
    sourceId: row.source_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    metadata: asMetadata(row.metadata),
    sortOrder: row.sort_order,
    createdAt: row.created_at ?? '',
  }
}

export function mapInvoicePayment(row: Tables<'invoice_payments'>): InvoicePayment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount),
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    note: row.note,
    recordedBy: row.recorded_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function mapBillingUtilityUsage(
  row: Tables<'billing_utility_usages'>,
): BillingUtilityUsage {
  return {
    id: row.id,
    billingPeriodId: row.billing_period_id,
    roomId: row.room_id,
    meterType: row.meter_type as MeterType,
    previousReadingId: row.previous_reading_id,
    previousReadingValue: Number(row.previous_reading_value),
    currentReadingId: row.current_reading_id,
    currentReadingValue: Number(row.current_reading_value),
    oldMeterFinalValue:
      row.old_meter_final_value === null ? null : Number(row.old_meter_final_value),
    newMeterStartValue:
      row.new_meter_start_value === null ? null : Number(row.new_meter_start_value),
    billableUsage: Number(row.billable_usage),
    reason: row.reason as UtilityUsageReason,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function mapBillingAuditEvent(
  row: Tables<'billing_audit_events'>,
): BillingAuditEvent {
  return {
    id: row.id,
    billingPeriodId: row.billing_period_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type as BillingAuditEntityType,
    entityId: row.entity_id,
    beforeData: row.before_data,
    afterData: row.after_data,
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at ?? '',
  }
}
