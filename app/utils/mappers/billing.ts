import type { Tables } from '~/types/database.types'
import type {
  BillingPeriod,
  BillingPeriodStatus,
  BillingRun,
  BillingRunStatus,
  BillingItem,
  BillingPaymentStatus,
  BillingPaymentMethod,
  BillingContractSnapshot,
  BillingServiceSnapshot,
  BillingUtilitySnapshot,
} from '~/types/billing'

export function mapBillingPeriod(row: Tables<'billing_periods'>): BillingPeriod {
  return {
    id: row.id,
    buildingId: row.building_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    status: row.status as BillingPeriodStatus,
    finalizedAt: row.finalized_at,
    finalizedBy: row.finalized_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBillingRun(row: Tables<'billing_runs'>): BillingRun {
  return {
    id: row.id,
    billingPeriodId: row.billing_period_id,
    buildingId: row.building_id,
    status: row.status as BillingRunStatus,
    schemaVersion: row.schema_version,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    itemCount: row.item_count,
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBillingItem(row: Tables<'billing_items'>): BillingItem {
  return {
    id: row.id,
    billingRunId: row.billing_run_id,
    roomId: row.room_id,
    contractId: row.contract_id,
    tenantId: row.tenant_id,
    rentAmount: Number(row.rent_amount),
    serviceAmount: Number(row.service_amount),
    electricityAmount: Number(row.electricity_amount),
    waterAmount: Number(row.water_amount),
    utilityAmount: Number(row.utility_amount),
    totalAmount: Number(row.total_amount),
    paymentStatus: row.payment_status as BillingPaymentStatus,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    paymentMethod: (row.payment_method as BillingPaymentMethod) ?? null,
    paymentNote: row.payment_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBillingContractSnapshot(row: Tables<'billing_contract_snapshots'>): BillingContractSnapshot {
  return {
    id: row.id,
    billingItemId: row.billing_item_id,
    monthlyRent: Number(row.monthly_rent),
    surchargeAmount: Number(row.surcharge_amount),
    discountAmount: Number(row.discount_amount),
    paymentDay: row.payment_day,
    occupantCount: row.occupant_count,
    createdAt: row.created_at,
  }
}

export function mapBillingServiceSnapshot(row: Tables<'billing_service_snapshots'>): BillingServiceSnapshot {
  return {
    id: row.id,
    billingItemId: row.billing_item_id,
    catalogId: row.catalog_id,
    serviceName: row.service_name,
    pricingType: row.pricing_type as 'fixed' | 'per_person',
    amount: Number(row.amount),
    quantity: row.quantity,
    total: Number(row.total),
    createdAt: row.created_at,
  }
}

export function mapBillingUtilitySnapshot(row: Tables<'billing_utility_snapshots'>): BillingUtilitySnapshot {
  return {
    id: row.id,
    billingItemId: row.billing_item_id,
    meterType: row.meter_type as 'electricity' | 'water',
    oldReading: row.old_reading != null ? Number(row.old_reading) : null,
    newReading: row.new_reading != null ? Number(row.new_reading) : null,
    consumption: row.consumption != null ? Number(row.consumption) : null,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
    total: Number(row.total),
    isAdjusted: row.is_adjusted,
    adjustmentReason: row.adjustment_reason,
    createdAt: row.created_at,
  }
}
