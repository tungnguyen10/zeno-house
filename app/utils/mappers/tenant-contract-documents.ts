import type { TenantContractDocument } from '~/types/tenant-contract-documents'
import type { ContractDocumentRow } from './contract-documents'

export function mapTenantContractDocument(row: ContractDocumentRow): TenantContractDocument | null {
  if (!['issued', 'signed'].includes(row.status) || !row.storage_path) return null
  return {
    id: row.id,
    type: row.type,
    versionNo: row.version_no,
    status: row.status as TenantContractDocument['status'],
    signedDate: row.signed_date,
    issuedAt: row.issued_at,
    signedAt: row.signed_at,
    sizeBytes: row.size_bytes,
  }
}
