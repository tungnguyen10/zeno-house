import { describe, expect, it } from 'vitest'
import { mapContractDocument, type ContractDocumentRow } from '~/utils/mappers/contract-documents'

const row: ContractDocumentRow = {
  id: 'd-1', contract_id: 'c-1', building_id: 'b-1', type: 'contract', amendment_id: null,
  version_no: 2, status: 'issued', template_key: 'hop-dong-thue-phong', template_version: 1,
  storage_path: 'b-1/c-1/d-1.docx', sha256: 'a'.repeat(64), size_bytes: 1234, last_error_code: null,
  snapshot: { tenant: { id_number: '012345678901' } }, signed_date: '2026-11-12',
  issued_by: 'u-1', issued_at: '2026-11-12T00:00:00Z', signed_by: null, signed_at: null,
  voided_by: null, voided_at: null, void_reason: null, replaces_document_id: null,
  created_at: '2026-11-12T00:00:00Z',
}

describe('mapContractDocument', () => {
  it('maps row to DTO fields', () => {
    const dto = mapContractDocument(row)
    expect(dto).toMatchObject({
      id: 'd-1', contractId: 'c-1', buildingId: 'b-1', type: 'contract', versionNo: 2,
      status: 'issued', templateKey: 'hop-dong-thue-phong', templateVersion: 1, sizeBytes: 1234,
      signedDate: '2026-11-12', issuedBy: 'u-1',
    })
  })

  it('never exposes snapshot or storage_path', () => {
    const json = JSON.stringify(mapContractDocument(row))
    expect(json).not.toContain('storage_path')
    expect(json).not.toContain('storagePath')
    expect(json).not.toContain('snapshot')
    expect(json).not.toContain('012345678901')
  })
})
