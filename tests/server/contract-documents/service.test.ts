import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findContract = vi.fn()
const repo = {
  listByContract: vi.fn(), reserve: vi.fn(), upload: vi.fn(), finalize: vi.fn(), fail: vi.fn(),
  removeObject: vi.fn(), markSigned: vi.fn(), void: vi.fn(), findById: vi.fn(), signedUrl: vi.fn(), claimStale: vi.fn(),
}
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()
const gatherContractSources = vi.fn()
const gatherReadinessSources = vi.fn()
const collectMissing = vi.fn()
const renderDocx = vi.fn()

vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findByIdentifier: findContract } }))
vi.mock('../../../server/repositories/contract-documents', () => ({ ContractDocumentRepository: repo }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))
vi.mock('../../../server/services/contract-documents/sources', () => ({ gatherContractSources, gatherReadinessSources }))
vi.mock('../../../server/services/contract-documents/missing', () => ({ collectMissing }))
vi.mock('../../../server/services/contract-documents/render', () => ({ renderDocx }))
vi.mock('../../../server/services/contract-documents/build-data', () => ({ buildContractDocumentData: () => ({ built: true }) }))

const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'd-1', contract_id: 'c-1', building_id: 'b-1', type: 'contract', amendment_id: null, version_no: 1,
    status: 'issued', template_key: 'hop-dong-thue-phong', template_version: 1, storage_path: 'b-1/c-1/d-1.docx',
    sha256: 'abc', size_bytes: 10, last_error_code: null, snapshot: { built: true }, signed_date: '2026-11-12',
    issued_by: 'o-1', issued_at: 't', signed_by: null, signed_at: null, voided_by: null, voided_at: null,
    void_reason: null, replaces_document_id: null, created_at: 't', ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (user: AuthUser, cap: string) => {
    const role = String(user.app_metadata?.role)
    if (cap === 'contract-documents.sign' || cap === 'contract-documents.void') return role === 'owner' || role === 'admin'
    return ['owner', 'admin', 'manager'].includes(role)
  })
  findContract.mockResolvedValue({ id: 'c-1', buildingId: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
  repo.listByContract.mockResolvedValue([])
  gatherContractSources.mockResolvedValue({ any: true })
  collectMissing.mockReturnValue([])
  renderDocx.mockReturnValue(Buffer.from('docx'))
  repo.reserve.mockResolvedValue(row({ status: 'pending' }))
  repo.upload.mockResolvedValue(undefined)
  repo.finalize.mockResolvedValue(row({ status: 'issued' }))
  repo.fail.mockResolvedValue(row({ status: 'failed' }))
  repo.removeObject.mockResolvedValue(undefined)
  repo.markSigned.mockResolvedValue(row({ status: 'signed' }))
  repo.void.mockResolvedValue(row({ status: 'voided' }))
  repo.signedUrl.mockResolvedValue({ url: 'https://x', expiresIn: 60 })
})

const issueInput = { type: 'contract' as const, signed_date: '2026-11-12', request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f' }

describe('ContractDocumentService.issue', () => {
  it('reserve → upload → finalize and audits (no PII)', async () => {
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    const res = await ContractDocumentService.issue(ev(), owner, 'c-1', issueInput)
    expect(res.id).toBe('d-1')
    expect(repo.reserve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshot: { built: true }, type: 'contract' }))
    expect(repo.upload).toHaveBeenCalled()
    expect(repo.finalize).toHaveBeenCalled()
    const audit = appendAudit.mock.calls[0]![2]
    expect(audit.action).toBe('contract.document.issued')
    expect(JSON.stringify(audit)).not.toContain('built')
  })

  it('rejects with 422 when data is incomplete', async () => {
    collectMissing.mockReturnValue([{ code: 'lessor.id_number', label: 'x' }])
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    await expect(ContractDocumentService.issue(ev(), owner, 'c-1', issueInput)).rejects.toMatchObject({ statusCode: 422 })
    expect(repo.reserve).not.toHaveBeenCalled()
  })

  it('fails the document and keeps snapshot when upload fails', async () => {
    repo.upload.mockRejectedValue(new Error('storage down'))
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    await expect(ContractDocumentService.issue(ev(), owner, 'c-1', issueInput)).rejects.toThrow('storage down')
    expect(repo.fail).toHaveBeenCalledWith(expect.anything(), 'd-1', 'UPLOAD_FAILED')
    expect(repo.finalize).not.toHaveBeenCalled()
  })

  it('removes the object and fails when finalize fails', async () => {
    repo.finalize.mockRejectedValue(new Error('finalize down'))
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    await expect(ContractDocumentService.issue(ev(), owner, 'c-1', issueInput)).rejects.toThrow('finalize down')
    expect(repo.removeObject).toHaveBeenCalled()
    expect(repo.fail).toHaveBeenCalledWith(expect.anything(), 'd-1', 'FINALIZE_FAILED')
  })

  it('is idempotent: returns the existing issued document without a new reserve', async () => {
    repo.listByContract.mockResolvedValue([row({ status: 'issued' })])
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    const res = await ContractDocumentService.issue(ev(), owner, 'c-1', issueInput)
    expect(res.id).toBe('d-1')
    expect(repo.reserve).not.toHaveBeenCalled()
  })
})

describe('ContractDocumentService.regenerate', () => {
  it('re-renders from the stored snapshot (not live data)', async () => {
    repo.findById.mockResolvedValue(row({ status: 'failed', snapshot: { stored: true } }))
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    await ContractDocumentService.regenerate(ev(), owner, 'd-1')
    expect(renderDocx).toHaveBeenCalledWith(expect.anything(), { stored: true })
    expect(gatherContractSources).not.toHaveBeenCalled()
    expect(repo.finalize).toHaveBeenCalled()
  })
})

describe('ContractDocumentService sign/void permissions', () => {
  it('forbids a manager from signing', async () => {
    repo.findById.mockResolvedValue(row())
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    await expect(ContractDocumentService.sign(ev(), manager, 'd-1')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('forbids a manager from voiding', async () => {
    repo.findById.mockResolvedValue(row())
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    await expect(ContractDocumentService.void(ev(), manager, 'd-1', 'lý do hủy hợp lệ')).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('ContractDocumentService.readiness', () => {
  it('returns ready when nothing is missing (pre-contract)', async () => {
    gatherReadinessSources.mockResolvedValue({ buildingId: 'b-1', sources: { any: true } })
    collectMissing.mockReturnValue([])
    const { ContractDocumentService } = await import('../../../server/services/contract-documents')
    const res = await ContractDocumentService.readiness(ev(), owner, { room_id: 'r-1', tenant_id: 't-1', occupant_tenant_ids: [] })
    expect(res.ready).toBe(true)
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'read')
  })
})
