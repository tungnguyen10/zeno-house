import type { TenantSupportRequest } from './tenant-portal'

export interface OperatorTenantSupportRequest extends TenantSupportRequest {
  tenantId: string
  buildingId: string
  contractId: string
  tenantCode: string
  tenantLabel: string
}
export interface TenantSupportRequestPage {
  data: TenantSupportRequest[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
export interface TenantSupportRequestQueuePage {
  data: OperatorTenantSupportRequest[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
