import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantContractDocument } from '~/types/tenant-contract-documents'
import { mapTenantContractDocument } from '~/utils/mappers/tenant-contract-documents'
import { ContractDocumentRepository } from '../../repositories/contract-documents'
import { TenantHousingRepository } from '../../repositories/tenant-portal/housing'
import { resolveTenantId } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { vietnamDateISO } from '../../utils/date'
import { throwForbidden, throwNotFound } from '../../utils/errors'

async function primaryHousing(event: H3Event, user: AuthUser) {
  if (!can(user, 'tenant.contract.read')) throwForbidden('Không có quyền xem hợp đồng')
  const tenantId = await resolveTenantId(event, user)
  const housing = await TenantHousingRepository.resolveActive(event, tenantId, vietnamDateISO())
  // The full agreement includes legal identity details belonging to its parties.
  return housing?.assignmentRole === 'primary' ? housing : null
}

export const TenantContractDocumentService = {
  async list(event: H3Event, user: AuthUser): Promise<TenantContractDocument[]> {
    const housing = await primaryHousing(event, user)
    if (!housing) return []
    const rows = await ContractDocumentRepository.listByContract(event, housing.contractId)
    return rows.flatMap((row) => {
      if (row.contract_id !== housing.contractId || row.building_id !== housing.buildingId) return []
      const document = mapTenantContractDocument(row)
      return document ? [document] : []
    })
  },

  async download(event: H3Event, user: AuthUser, id: string): Promise<{ url: string; expiresIn: number }> {
    const housing = await primaryHousing(event, user)
    if (!housing) throwNotFound('Không tìm thấy tài liệu')
    const row = await ContractDocumentRepository.findById(event, id)
    if (!row || row.contract_id !== housing.contractId || row.building_id !== housing.buildingId
      || !mapTenantContractDocument(row)) throwNotFound('Không tìm thấy tài liệu')
    // Sign only the canonical private path after verifying the caller and row.
    const expectedPath = `${housing.buildingId}/${housing.contractId}/${row.id}.docx`
    if (row.storage_path !== expectedPath) throwNotFound('Không tìm thấy tài liệu')
    return ContractDocumentRepository.signedUrl(event, expectedPath)
  },
}
