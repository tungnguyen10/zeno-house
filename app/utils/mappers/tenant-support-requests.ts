import type { OperatorTenantSupportRequest } from '~/types/tenant-support-requests'
import { mapTenantSupportRequest, type TenantSupportRequestRow } from './tenant-portal'

export function mapOperatorTenantSupportRequest(
  row: TenantSupportRequestRow,
  tenantLabel: string,
  tenantCode: string,
  attachmentSignedUrl: string | null,
  attachmentUnavailable: boolean,
): OperatorTenantSupportRequest {
  return { ...mapTenantSupportRequest(row, attachmentSignedUrl), tenantId: row.tenant_id, buildingId: row.building_id, contractId: row.contract_id, tenantLabel, tenantCode, attachmentUnavailable }
}
