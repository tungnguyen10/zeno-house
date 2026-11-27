/** Tenant-safe metadata only; no legal snapshot, storage path or staff identity. */
export interface TenantContractDocument {
  id: string
  type: 'contract' | 'appendix'
  versionNo: number
  status: 'issued' | 'signed'
  signedDate: string | null
  issuedAt: string | null
  signedAt: string | null
  sizeBytes: number | null
}
