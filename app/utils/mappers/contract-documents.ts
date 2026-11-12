import type { ContractDocument } from '~/types/contract-documents'

/** Raw `contract_documents` row shape (service-role only; cast until types regen). */
export interface ContractDocumentRow {
  id: string
  contract_id: string
  building_id: string
  type: 'contract' | 'appendix'
  amendment_id: string | null
  version_no: number
  status: 'pending' | 'failed' | 'issued' | 'signed' | 'voided'
  template_key: string
  template_version: number
  storage_path: string | null
  sha256: string | null
  size_bytes: number | null
  last_error_code: string | null
  snapshot: unknown
  signed_date: string | null
  issued_by: string | null
  issued_at: string | null
  signed_by: string | null
  signed_at: string | null
  voided_by: string | null
  voided_at: string | null
  void_reason: string | null
  replaces_document_id: string | null
  created_at: string
}

/** Maps a row to the client DTO. Never exposes `snapshot` or `storage_path`. */
export function mapContractDocument(row: ContractDocumentRow): ContractDocument {
  return {
    id: row.id,
    contractId: row.contract_id,
    buildingId: row.building_id,
    type: row.type,
    amendmentId: row.amendment_id,
    versionNo: row.version_no,
    status: row.status,
    templateKey: row.template_key,
    templateVersion: row.template_version,
    lastErrorCode: row.last_error_code,
    signedDate: row.signed_date,
    issuedAt: row.issued_at,
    issuedBy: row.issued_by,
    signedAt: row.signed_at,
    signedBy: row.signed_by,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    replacesDocumentId: row.replaces_document_id,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  }
}
