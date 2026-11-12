import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({ candidates: vi.fn(), find: vi.fn(), details: vi.fn(), update: vi.fn(), scope: vi.fn(), access: vi.fn(), sign: vi.fn() }))
vi.mock('../../../server/repositories/tenant-portal/requests', () => ({ TenantSupportRequestRepository: { listOperatorCandidates: mocks.candidates, findOperatorCandidate: mocks.find, findByIds: mocks.details, updateStatusWithAudit: mocks.update } }))
vi.mock('../../../server/services/tenants/authorization', () => ({ TenantAuthorizationService: { resolveAccessMany: mocks.access } }))
vi.mock('../../../server/utils/scope', () => ({ getVisibleBuildingIds: mocks.scope }))
vi.mock('../../../server/repositories/tenant-portal/documents', () => ({ TenantDocumentRepository: { createSignedUrl: mocks.sign } }))
const owner = { id: 'owner', app_metadata: { role: 'owner' } } as AuthUser
const tenant = { id: 'tenant-user', app_metadata: { role: 'tenant' } } as AuthUser
const row = { id: 'request-1', tenant_id: 'tenant-1', building_id: 'building-1', contract_id: 'contract-1', title: 'Correction', description: 'Private correction text', status: 'new', attachment_path: 'tenant-1/requests/one.pdf', created_at: '2026-11-10', updated_at: '2026-11-10' }
const candidate = { id: row.id, tenant_id: row.tenant_id, building_id: row.building_id, contract_id: row.contract_id, status: row.status, created_at: row.created_at }
const svc = async () => (await import('../../../server/services/tenant-portal/operator-requests')).TenantSupportRequestOperatorService
beforeEach(() => {
  vi.clearAllMocks()
  mocks.scope.mockResolvedValue(['building-1'])
  mocks.candidates.mockResolvedValue([candidate])
  mocks.find.mockResolvedValue(candidate)
  mocks.details.mockResolvedValue([row])
  mocks.update.mockResolvedValue({ ...row, status: 'in_progress' })
  mocks.access.mockResolvedValue(new Map([['tenant-1', { level: 'full', tenant: { fullName: 'Synthetic Tenant' } }]]))
  mocks.sign.mockResolvedValue('https://evidence.example/signed')
})
describe('staff request queue authorization', () => {
  it.each(['admin', 'owner', 'manager'])('allows %s with full access before fetching text or signing', async (role) => {
    const result = await (await svc()).list({} as never, { ...owner, app_metadata: { role } } as AuthUser, {})
    expect(result.meta.total).toBe(1)
    expect(result.data[0]).toMatchObject({ tenantLabel: 'Synthetic Tenant', description: row.description })
    expect(mocks.access.mock.invocationCallOrder[0]).toBeLessThan(mocks.details.mock.invocationCallOrder[0]!)
    expect(mocks.details.mock.invocationCallOrder[0]).toBeLessThan(mocks.sign.mock.invocationCallOrder[0]!)
  })
  it.each(['basic', 'none'])('never fetches text or signs %s access', async (level) => {
    mocks.access.mockResolvedValue(new Map([['tenant-1', { level }]]))
    expect(await (await svc()).list({} as never, owner, {})).toMatchObject({ data: [], meta: { total: 0 } })
    expect(mocks.details).not.toHaveBeenCalled()
    expect(mocks.sign).not.toHaveBeenCalled()
  })
  it('counts and paginates only authorized candidates', async () => {
    mocks.candidates.mockResolvedValue([{ ...candidate, id: 'private', tenant_id: 'tenant-private' }, candidate])
    const result = await (await svc()).list({} as never, owner, { page: 1, limit: 1 })
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 1, totalPages: 1 })
    expect(mocks.details).toHaveBeenCalledWith(expect.anything(), ['request-1'])
  })
  it('never falls back to an unscoped query for empty visible scope', async () => {
    mocks.scope.mockResolvedValue([])
    expect(await (await svc()).list({} as never, owner, {})).toMatchObject({ data: [], meta: { total: 0 } })
    expect(mocks.candidates).not.toHaveBeenCalled()
  })
  it('rejects tenant callers before scope/query', async () => {
    await expect((await svc()).list({} as never, tenant, {})).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.scope).not.toHaveBeenCalled()
  })
  it('contains missing attachment errors per row', async () => {
    mocks.sign.mockRejectedValue(new Error('missing private path'))
    const result = await (await svc()).list({} as never, owner, {})
    expect(result.data[0]).toMatchObject({ attachmentSignedUrl: null, attachmentUnavailable: true })
    expect(JSON.stringify(result)).not.toContain('attachment_path')
  })
  it('does not sign malformed or cross-tenant evidence paths', async () => {
    mocks.details.mockResolvedValue([{ ...row, attachment_path: 'tenant-2/requests/private.pdf' }])
    expect((await (await svc()).list({} as never, owner, {})).data[0]?.attachmentUnavailable).toBe(true)
    expect(mocks.sign).not.toHaveBeenCalled()
  })
})
describe('staff request status', () => {
  it('authorizes full scope before invoking atomic RPC with actor and expected status', async () => {
    await (await svc()).updateStatus({} as never, owner, 'request-1', { status: 'in_progress', expected_status: 'new' })
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), 'request-1', { status: 'in_progress', expected_status: 'new' }, 'owner')
    expect(mocks.access.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]!)
  })
  it.each(['basic', 'none'])('returns consistent404 for %s access', async (level) => {
    mocks.access.mockResolvedValue(new Map([['tenant-1', { level }]]))
    await expect((await svc()).updateStatus({} as never, owner, 'request-1', { status: 'resolved', expected_status: 'in_progress' })).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('returns the same404 outside visible building scope', async () => {
    mocks.scope.mockResolvedValue(['other-building'])
    await expect((await svc()).updateStatus({} as never, owner, 'request-1', { status: 'resolved', expected_status: 'in_progress' })).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.access).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('strictly rejects unsupported/extra status input before repository reads', async () => {
    await expect((await svc()).updateStatus({} as never, owner, 'request-1', { status: 'approved', expected_status: 'new', description: 'private' })).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.find).not.toHaveBeenCalled()
  })
  it('preserves atomic stale409 from the repository without a second write', async () => {
    mocks.update.mockRejectedValue({ statusCode: 409 })
    await expect((await svc()).updateStatus({} as never, owner, 'request-1', { status: 'resolved', expected_status: 'in_progress' })).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })
})
