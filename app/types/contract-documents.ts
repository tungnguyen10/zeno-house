export type ContractDocumentType = 'contract' | 'appendix'
export type ContractDocumentStatus = 'pending' | 'failed' | 'issued' | 'signed' | 'voided'

/** Client-facing document metadata. Never includes `snapshot` or `storage_path`. */
export interface ContractDocument {
  id: string
  contractId: string
  buildingId: string
  type: ContractDocumentType
  amendmentId: string | null
  versionNo: number
  status: ContractDocumentStatus
  templateKey: string
  templateVersion: number
  lastErrorCode: string | null
  signedDate: string | null
  issuedAt: string | null
  issuedBy: string | null
  signedAt: string | null
  signedBy: string | null
  voidedAt: string | null
  voidReason: string | null
  replacesDocumentId: string | null
  sizeBytes: number | null
  createdAt: string
}

export interface ContractDocumentMissing {
  code: string
  label: string
}

export interface ContractDocumentReadiness {
  ready: boolean
  missing: ContractDocumentMissing[]
}
