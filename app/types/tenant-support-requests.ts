import type { TenantSupportRequest } from './tenant-portal'

export interface OperatorTenantSupportRequest extends TenantSupportRequest {
  tenantId: string
  buildingId: string
  contractId: string
  tenantCode: string
  tenantLabel: string
  attachmentUnavailable: boolean
}
export interface TenantSupportRequestQueuePage {
  data: OperatorTenantSupportRequest[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
