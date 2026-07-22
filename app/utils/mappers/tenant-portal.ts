import type {
  TenantContractSummary,
  TenantInvoiceDetail,
  TenantInvoiceListItem,
  TenantProfile,
  TenantSupportRequest,
  TenantSupportRequestStatus,
} from '~/types/tenant-portal'
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
  notes: string | null
}

interface TenantContractSummaryRow {
  id: string
  contract_code: string
  start_date: string
  end_date: string
  monthly_rent: number
  deposit: number
  status: string
  rooms: {
    room_number: string | null
    buildings: { name: string | null } | null
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
}

export type TenantSupportRequestRow = Tables<'support_requests'>

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
    notes: row.notes,
  }
}

export function mapTenantContractSummary(
  row: TenantContractSummaryRow,
  assignmentRole: TenantContractSummary['assignmentRole'] = 'primary',
  primaryTenantName: string | null = null,
): TenantContractSummary {
  return {
    id: row.id,
    contractCode: row.contract_code,
    roomNumber: row.rooms?.room_number ?? '',
    buildingName: row.rooms?.buildings?.name ?? '',
    startDate: row.start_date,
    endDate: row.end_date,
    monthlyRent: row.monthly_rent,
    deposit: row.deposit,
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
): TenantInvoiceDetail {
  return {
    ...mapTenantInvoiceListItem(row),
    charges: charges.map(charge => ({
      id: charge.id,
      chargeType: charge.charge_type,
      label: charge.label,
      quantity: charge.quantity,
      unitPrice: charge.unit_price,
      amount: charge.amount,
      sortOrder: charge.sort_order,
    })),
  }
}

export function mapTenantSupportRequest(
  row: TenantSupportRequestRow,
  attachmentSignedUrl: string | null = null,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
