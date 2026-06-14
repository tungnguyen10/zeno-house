export const BILLING_PERIOD_STATUSES = [
  'draft',
  'readings',
  'review',
  'issued',
  'collecting',
  'closed',
] as const

export type BillingPeriodStatus = (typeof BILLING_PERIOD_STATUSES)[number]

export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'partial',
  'paid',
  'overdue',
  'void',
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const CHARGE_TYPES = [
  'rent',
  'electricity',
  'water',
  'service',
  'discount',
  'surcharge',
  'adjustment',
] as const

export type ChargeType = (typeof CHARGE_TYPES)[number]

export const METER_TYPES = ['electricity', 'water'] as const
export type MeterType = (typeof METER_TYPES)[number]

export const UTILITY_USAGE_REASONS = [
  'normal',
  'replacement',
  'reset',
  'correction',
  'manual_adjustment',
] as const

export type UtilityUsageReason = (typeof UTILITY_USAGE_REASONS)[number]

export const BILLING_AUDIT_ENTITY_TYPES = [
  'billing_period',
  'meter_reading',
  'billing_utility_usage',
  'invoice',
  'invoice_charge',
  'invoice_payment',
] as const

export type BillingAuditEntityType = (typeof BILLING_AUDIT_ENTITY_TYPES)[number]

/**
 * Action codes for billing audit events. Stored as plain strings in DB to
 * keep the table flexible, but standardized here so writers and readers
 * agree.
 */
export const BILLING_AUDIT_ACTIONS = {
  PERIOD_OPENED: 'period.opened',
  PERIOD_STATUS_CHANGED: 'period.status_changed',
  PERIOD_CLOSED: 'period.closed',
  PERIOD_REOPENED: 'period.reopened',
  READING_SAVED: 'reading.saved',
  UTILITY_OVERRIDE_SAVED: 'utility_override.saved',
  ISSUE_ATTEMPTED: 'invoice.issue_attempted',
  INVOICES_ISSUED: 'invoices.issued',
  INVOICE_VOIDED: 'invoice.voided',
  INVOICE_REISSUED: 'invoice.reissued',
  ADJUSTMENT_CREATED: 'invoice.adjustment_created',
  PAYMENT_RECORDED: 'invoice.payment_recorded',
  PAYMENTS_BULK_RECORDED: 'payments.bulk_recorded',
  PERIOD_UNISSUED: 'period.unissued',
} as const

export type BillingAuditAction =
  (typeof BILLING_AUDIT_ACTIONS)[keyof typeof BILLING_AUDIT_ACTIONS]

/**
 * Stable codes for blockers/warnings surfaced from draft calculation.
 */
export const BILLING_BLOCKER_CODES = {
  MISSING_CURRENT_READING: 'missing_current_reading',
  MISSING_PREVIOUS_READING: 'missing_previous_reading',
  MISSING_ELECTRICITY_RATE: 'missing_electricity_rate',
  MISSING_WATER_RATE: 'missing_water_rate',
  NEGATIVE_CONSUMPTION: 'negative_consumption',
  TIERED_ELECTRICITY_UNSUPPORTED: 'tiered_electricity_unsupported',
  DUPLICATE_INVOICE: 'duplicate_invoice',
  MISSING_BILLING_REFERENCE: 'missing_billing_reference',
} as const

export type BillingBlockerCode =
  (typeof BILLING_BLOCKER_CODES)[keyof typeof BILLING_BLOCKER_CODES]

export const BILLING_WARNING_CODES = {
  USAGE_OVERRIDE_APPLIED: 'usage_override_applied',
  HANDOVER_FALLBACK_PREVIOUS: 'handover_fallback_previous',
  OCCUPANT_FALLBACK_TO_CONTRACT: 'occupant_fallback_to_contract',
} as const

export type BillingWarningCode =
  (typeof BILLING_WARNING_CODES)[keyof typeof BILLING_WARNING_CODES]
