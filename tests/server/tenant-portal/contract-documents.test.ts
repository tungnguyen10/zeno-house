import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContractDocumentRow } from '../../../app/utils/mappers/contract-documents'

const mocks = vi.hoisted(() => ({ resolveTenantId: vi.fn(), housing: vi.fn(), list: vi.fn(), find: vi.fn(), sign: vi.fn(), can: vi.fn() }))
vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: mocks.resolveTenantId }))
vi.mock('../../../server/utils/permissions', () => ({ can: mocks.can }))
vi.mock('../../../server/repositories/tenant-portal/housing', () => ({ TenantHousingRepository: { resolveActive: mocks.housing } }))
vi.mock('../../../server/repositories/contract-documents', () => ({ ContractDocumentRepository: { listByContract: mocks.list, findById: mocks.find, signedUrl: mocks.sign } }))

const { TenantContractDocumentService } = await import('../../../server/services/tenant-portal/contract-documents')
const event = { context: {} } as never
const user = { id: 'auth-tenant' } as never
const housing = { contractId: 'contract-1', buildingId: 'building-1', assignmentRole: 'primary' }
const row = {
  id: 'doc-1', contract_id: 'contract-1', building_id: 'building-1', type: 'contract', version_no: 1,
  status: 'issued', storage_path: 'building-1/contract-1/doc-1.docx', snapshot: { private_id: 'never-return' },
  signed_date: '2026-11-01', issued_at: '2026-11-01T00:00:00Z', signed_at: null, size_bytes: 12000,
  issued_by: 'staff-private-id', last_error_code: null,
} as ContractDocumentRow

describe('tenant official contract documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.housing.mockResolvedValue(housing)
    mocks.list.mockResolvedValue([row])
    mocks.find.mockResolvedValue(row)
    mocks.sign.mockResolvedValue({ url: 'https://example.invalid/short-lived', expiresIn: 300 })
  })

  it('returns only issued/signed metadata belonging to the current primary contract', async () => {
    mocks.list.mockResolvedValue([row, { ...row, status: 'failed' }, { ...row, status: 'voided' }, { ...row, contract_id: 'other' }])
    const result = await TenantContractDocumentService.list(event, user)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ id: 'doc-1', type: 'contract', versionNo: 1, status: 'issued', signedDate: '2026-11-01', issuedAt: '2026-11-01T00:00:00Z', signedAt: null, sizeBytes: 12000 })
    expect(JSON.stringify(result)).not.toContain('never-return')
    expect(result[0]).not.toHaveProperty('storage_path')
    expect(result[0]).not.toHaveProperty('issuedBy')
  })

  it.each([null, { ...housing, assignmentRole: 'roommate' }])('denies file access without current primary housing: %j', async (context) => {
    mocks.housing.mockResolvedValue(context)
    expect(await TenantContractDocumentService.list(event, user)).toEqual([])
    await expect(TenantContractDocumentService.download(event, user, 'doc-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.sign).not.toHaveBeenCalled()
  })

  it.each([
    { contract_id: 'other-contract' }, { building_id: 'other-building' }, { status: 'voided' },
    { status: 'pending' }, { storage_path: null }, { storage_path: 'other/private.docx' },
  ])('never signs an unauthorized/unavailable document: %j', async (overrides) => {
    mocks.find.mockResolvedValue({ ...row, ...overrides })
    await expect(TenantContractDocumentService.download(event, user, 'doc-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.sign).not.toHaveBeenCalled()
  })

  it('signs the canonical path only after scope verification', async () => {
    await expect(TenantContractDocumentService.download(event, user, 'doc-1')).resolves.toEqual({ url: 'https://example.invalid/short-lived', expiresIn: 300 })
    expect(mocks.sign).toHaveBeenCalledWith(event, 'building-1/contract-1/doc-1.docx')
  })

  it('rejects a disabled or unlinked account before looking up documents', async () => {
    mocks.resolveTenantId.mockRejectedValue(Object.assign(new Error('Not found'), { statusCode: 404 }))
    await expect(TenantContractDocumentService.list(event, user)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.housing).not.toHaveBeenCalled()
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
