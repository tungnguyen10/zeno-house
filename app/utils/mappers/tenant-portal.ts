import type {
  TenantContractSummary,
  TenantInvoiceDetail,
  TenantInvoiceListItem,
  TenantInvoiceMeterReading,
  TenantInvoicePayment,
  TenantProfile,
  TenantSupportRequest,
  TenantSupportRequestStatus,
} from '~/types/tenant-portal'
import type { InvoiceProfileDisplay } from '~/types/building-invoice-profile'
import type { ContractStatus } from '~/types/contracts'
import type { Tables } from '~/types/database.types'
import type { InvoiceListItem } from '~/utils/validators/invoices'

interface TenantProfileRow {
  id: string
  code: string
  status: string
  full_name: string
  phone: string
  email: string | null
  gender: string | null
  date_of_birth: string | null
  occupation: string | null
  permanent_address: string | null
  id_number: string | null
  id_issued_date: string | null
  id_issued_place: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

interface TenantContractSummaryRow {
  id: string
  contract_code: string
  start_date: string
  end_date: string
  monthly_rent: number
  deposit: number
  payment_due_day: number | null
  occupant_count: number
  discount_amount: number
  surcharge_amount: number
  status: string
  rooms: {
    room_number: string | null
    buildings: { name: string | null; payment_due_day: number | null } | null
  } | null
}

interface TenantInvoiceChargeRow {
  id: string
  invoice_id: string
  charge_type: string
  label: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
  metadata?: unknown
}

interface TenantInvoicePaymentRow {
  id: string
  amount: number
  paid_at: string
  payment_method: string | null
  funding_source: string | null
}

function snapshotNumber(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return null
  const result = Number(value)
  return Number.isFinite(result) && result >= 0 ? result : null
}

function mapMeterReading(charge: TenantInvoiceChargeRow): TenantInvoiceMeterReading | null {
  if (charge.charge_type !== 'electricity' && charge.charge_type !== 'water') return null
  if (!charge.metadata || typeof charge.metadata !== 'object' || Array.isArray(charge.metadata)) return null
  const metadata = charge.metadata as Record<string, unknown>
  const previousValue = snapshotNumber(metadata.previous_reading_value)
  const currentValue = snapshotNumber(metadata.current_reading_value)
  const billableUsage = snapshotNumber(metadata.billable_usage)
  if (previousValue === null && currentValue === null && billableUsage === null) return null
  return {
    previousValue,
    currentValue,
    billableUsage,
    unit: charge.charge_type === 'electricity' ? 'kWh' : 'm³',
    adjusted: metadata.source === 'usage_override'
      || ['replacement', 'reset', 'correction', 'manual_adjustment'].includes(String(metadata.reason))
      || (previousValue !== null && currentValue !== null && billableUsage !== null
        && Math.abs(currentValue - previousValue - billableUsage) > 0.0005),
  }
}

function mapTenantInvoicePayment(row: TenantInvoicePaymentRow): TenantInvoicePayment {
  return {
    id: row.id,
    amount: Number(row.amount),
    paidAt: row.paid_at,
    method: row.payment_method,
    fundingSource: row.funding_source === 'cash' || row.funding_source === 'deposit' || row.funding_source === 'credit'
      ? row.funding_source
      : null,
  }
}

// The additive response migration is deployed before the application. Keep its
// raw-row boundary explicit until cloud-generated database types are refreshed.
export type TenantSupportRequestRow = Tables<'support_requests'> & {
  public_response?: string | null
  responded_at?: string | null
}

export function mapTenantProfile(row: TenantProfileRow): TenantProfile {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    gender: (row.gender as TenantProfile['gender']) ?? null,
    dateOfBirth: row.date_of_birth,
    occupation: row.occupation,
    permanentAddress: row.permanent_address,
    idNumber: row.id_number,
    idIssuedDate: row.id_issued_date,
    idIssuedPlace: row.id_issued_place,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
  }
}

export function mapTenantContractSummary(
  row: TenantContractSummaryRow,
  assignmentRole: TenantContractSummary['assignmentRole'] = 'primary',
  primaryTenantName: string | null = null,
): TenantContractSummary {
  const buildingDueDay = row.rooms?.buildings?.payment_due_day ?? null
  const paymentDueDay = row.payment_due_day ?? buildingDueDay
  return {
    id: row.id,
    contractCode: row.contract_code,
    roomNumber: row.rooms?.room_number ?? '',
    buildingName: row.rooms?.buildings?.name ?? '',
    startDate: row.start_date,
    endDate: row.end_date,
    monthlyRent: row.monthly_rent,
    deposit: row.deposit,
    paymentDueDay,
    paymentDueDaySource: row.payment_due_day !== null
      ? 'contract'
      : buildingDueDay !== null ? 'building' : 'unset',
    occupantCount: row.occupant_count,
    discountAmount: row.discount_amount,
    surchargeAmount: row.surcharge_amount,
    status: row.status as ContractStatus,
    assignmentRole,
    primaryTenantName,
  }
}

export function mapTenantInvoiceListItem(row: InvoiceListItem): TenantInvoiceListItem {
  return {
    id: row.id,
    invoiceCode: row.invoice_code,
    billingPeriodId: row.billing_period_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    buildingId: row.building_id,
    buildingName: row.building_name,
    buildingSlug: row.building_slug ?? null,
    roomId: row.room_id,
    roomNumber: row.room_number,
    contractId: row.contract_id,
    contractCode: row.contract_code,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    balanceAmount: row.balance_amount,
    dueDate: row.due_date,
    gracePeriodDays: row.grace_period_days,
    overdueDate: row.overdue_date,
    status: row.status,
    issuedAt: row.issued_at,
    voidedAt: row.voided_at ?? null,
    voidReason: row.void_reason ?? null,
    notes: row.notes ?? null,
  }
}

export function mapTenantInvoiceDetail(
  row: InvoiceListItem,
  charges: TenantInvoiceChargeRow[],
  invoiceProfile: InvoiceProfileDisplay | null = null,
  payments: TenantInvoicePaymentRow[] = [],
): TenantInvoiceDetail {
  return {
    ...mapTenantInvoiceListItem(row),
    invoiceProfile,
    payments: payments.map(mapTenantInvoicePayment),
    charges: charges.map(charge => ({
      id: charge.id,
      chargeType: charge.charge_type,
      label: charge.label,
      quantity: charge.quantity,
      unitPrice: charge.unit_price,
      amount: charge.amount,
      sortOrder: charge.sort_order,
      meterReading: mapMeterReading(charge),
    })),
  }
}

export function mapTenantSupportRequest(
  row: TenantSupportRequestRow,
  attachmentSignedUrl: string | null = null,
  attachmentUnavailable = false,
): TenantSupportRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    buildingId: row.building_id,
    contractId: row.contract_id,
    title: row.title,
    description: row.description,
    status: row.status as TenantSupportRequestStatus,
    attachmentSignedUrl,
    attachmentUnavailable,
    publicResponse: row.public_response ?? null,
    respondedAt: row.responded_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
