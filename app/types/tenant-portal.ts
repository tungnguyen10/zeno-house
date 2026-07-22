import type { ContractStatus } from '~/types/contracts'
import type { InvoiceStatus } from '~/utils/constants/billing'

export type TenantGender = 'male' | 'female' | 'other'

export interface TenantProfile {
  id: string
  code: string
  status: string
  fullName: string
  phone: string
  email: string | null
  gender: TenantGender | null
  dateOfBirth: string | null
  occupation: string | null
  permanentAddress: string | null
  idNumber: string | null
  idIssuedDate: string | null
  idIssuedPlace: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  notes: string | null
}

export interface TenantDocument {
  id: string
  name: string
  mimeType: string
  size: number
  createdAt: string
  signedUrl: string
}

export interface TenantIdentityImages {
  frontSignedUrl: string | null
  backSignedUrl: string | null
}

export type TenantSupportRequestStatus = 'new' | 'in_progress' | 'resolved'

export interface TenantSupportRequest {
  id: string
  tenantId: string
  buildingId: string
  contractId: string
  title: string
  description: string
  status: TenantSupportRequestStatus
  attachmentSignedUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface TenantContractSummary {
  id: string
  contractCode: string
  roomNumber: string
  buildingName: string
  startDate: string
  endDate: string
  monthlyRent: number
  deposit: number
  status: ContractStatus
  assignmentRole: 'primary' | 'roommate'
  primaryTenantName: string | null
}

export interface TenantInvoiceListItem {
  id: string
  invoiceCode: string
  billingPeriodId: string
  periodYear: number
  periodMonth: number
  buildingId: string
  buildingName: string | null
  buildingSlug: string | null
  roomId: string
  roomNumber: string | null
  contractId: string
  contractCode: string | null
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  dueDate: string | null
  status: InvoiceStatus
  issuedAt: string | null
  voidedAt: string | null
  voidReason: string | null
  notes: string | null
}

export interface TenantInvoiceDetail extends TenantInvoiceListItem {
  charges: Array<{
    id: string
    chargeType: string
    label: string
    quantity: number
    unitPrice: number
    amount: number
    sortOrder: number
  }>
}
