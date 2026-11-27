import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  getVisibleBuildingIds: vi.fn(),
  listByTenantId: vi.fn(),
  findByTenantId: vi.fn(),
  resolveHousing: vi.fn(),
  create: vi.fn(),
  listByBuildingIds: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  auditAppend: vi.fn(),
}))

vi.mock('../../../server/utils/scope', () => ({
  resolveTenantId: mocks.resolveTenantId,
  getVisibleBuildingIds: mocks.getVisibleBuildingIds,
}))
vi.mock('../../../server/repositories/tenant-portal/requests', () => ({
  TenantSupportRequestRepository: {
    listByTenantId: mocks.listByTenantId,
    findByTenantId: mocks.findByTenantId,
    create: mocks.create,
    listByBuildingIds: mocks.listByBuildingIds,
  },
}))
vi.mock('../../../server/repositories/tenant-portal/housing', () => ({
  TenantHousingRepository: { resolveActive: mocks.resolveHousing },
}))
vi.mock('../../../server/repositories/tenant-portal/documents', () => ({
  TenantDocumentRepository: {
    upload: mocks.upload,
    createSignedUrl: mocks.createSignedUrl,
    remove: mocks.remove,
  },
}))
vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: mocks.auditAppend },
}))

const tenant = { id: 'auth-tenant', app_metadata: { role: 'tenant' } } as AuthUser
const admin = { id: 'auth-admin', app_metadata: { role: 'admin' } } as AuthUser

const stored = {
  id: 'request-1',
  tenant_id: 'tenant-1',
  building_id: 'building-1',
  contract_id: 'contract-1',
  title: 'Leaking tap',
  description: 'Water is leaking.',
  status: 'new',
  attachment_path: null as string | null,
  created_at: '2026-07-17T10:00:00.000Z',
  updated_at: '2026-07-17T10:00:00.000Z',
}

async function service() {
  return (await import('../../../server/services/tenant-portal/requests'))
    .TenantSupportRequestService
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveTenantId.mockResolvedValue('tenant-1')
  mocks.getVisibleBuildingIds.mockResolvedValue(['building-1'])
  mocks.listByTenantId.mockResolvedValue({ rows: [stored], total: 1 })
  mocks.findByTenantId.mockResolvedValue(stored)
  mocks.resolveHousing.mockResolvedValue({
    contractId: 'contract-1',
    buildingId: 'building-1',
    primaryTenantId: 'tenant-primary',
    assignmentRole: 'roommate',
    primaryTenantName: 'Primary Tenant',
    contract: {},
  })
  mocks.create.mockImplementation((_event, input) => Promise.resolve({ ...stored, ...input }))
  mocks.listByBuildingIds.mockResolvedValue([stored])
  mocks.upload.mockResolvedValue({
    id: 'object-1',
    path: 'tenant-1/requests/uuid.jpg',
  })
  mocks.createSignedUrl.mockResolvedValue('https://signed.test/attachment')
  mocks.remove.mockResolvedValue(undefined)
  mocks.auditAppend.mockResolvedValue(undefined)
})

describe('TenantSupportRequestService tenant scope', () => {
  it('lists only requests for the resolved tenant and signs stored attachments', async () => {
    mocks.listByTenantId.mockResolvedValue({ rows: [{
      ...stored,
      attachment_path: 'tenant-1/requests/request-1/photo.jpg',
    }], total: 21 })
    const svc = await service()

    const result = await svc.list({} as never, tenant)

    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), tenant)
    expect(mocks.listByTenantId).toHaveBeenCalledWith(expect.anything(), 'tenant-1', { page: 1, limit: 20 })
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1/requests/request-1/photo.jpg',
    )
    expect(result.data[0]).toMatchObject({
      id: 'request-1',
      tenantId: 'tenant-1',
      status: 'new',
      attachmentSignedUrl: 'https://signed.test/attachment',
    })
    expect(result.meta).toEqual({ total: 21, page: 1, limit: 20, totalPages: 2 })
  })

  it('refuses to sign an attachment path outside the stored tenant request prefix', async () => {
    mocks.listByTenantId.mockResolvedValue({ rows: [{
      ...stored,
      attachment_path: 'tenant-2/requests/secret.pdf',
    }], total: 1 })
    const svc = await service()

    expect((await svc.list({} as never, tenant)).data[0]).toMatchObject({
      id: stored.id, attachmentSignedUrl: null, attachmentUnavailable: true,
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('keeps every request readable when one attachment signing fails', async () => {
    mocks.listByTenantId.mockResolvedValue({ rows: [
      { ...stored, attachment_path: 'tenant-1/requests/missing.pdf' },
      { ...stored, id: 'request-2', attachment_path: 'tenant-1/requests/available.pdf', public_response: 'We will visit tomorrow.', responded_at: '2026-07-18T10:00:00.000Z' },
    ], total: 2 })
    mocks.createSignedUrl.mockRejectedValueOnce(new Error('private object path'))
    const result = await (await service()).list({} as never, tenant)
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({ attachmentUnavailable: true, attachmentSignedUrl: null })
    expect(result.data[1]).toMatchObject({ attachmentUnavailable: false, publicResponse: 'We will visit tomorrow.' })
    expect(JSON.stringify(result)).not.toContain('private object path')
    expect(JSON.stringify(result)).not.toContain('attachment_path')
  })

  it('loads the full detail within the resolved tenant scope', async () => {
    mocks.findByTenantId.mockResolvedValue({ ...stored, public_response: 'A public reply', responded_at: stored.updated_at })
    const result = await (await service()).detail({} as never, tenant, stored.id)
    expect(mocks.findByTenantId).toHaveBeenCalledWith(expect.anything(), 'tenant-1', stored.id)
    expect(result).toMatchObject({ description: stored.description, publicResponse: 'A public reply', respondedAt: stored.updated_at })
  })

  it.each([null, { ...stored, tenant_id: 'tenant-2', attachment_path: 'tenant-2/requests/private.pdf' }])('rejects missing or foreign request details before signing', async (row) => {
    mocks.findByTenantId.mockResolvedValue(row)
    await expect((await service()).detail({} as never, tenant, stored.id)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects unsupported or unbounded pagination before reading requests', async () => {
    await expect((await service()).list({} as never, tenant, { page: 0, limit: 5000 })).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.listByTenantId).not.toHaveBeenCalled()
  })

  it('derives tenant, building, contract, and status server-side', async () => {
    const svc = await service()

    await svc.create({} as never, tenant, {
      title: ' Leaking tap ',
      description: ' Water is leaking. ',
      tenant_id: 'other-tenant',
      building_id: 'other-building',
      contract_id: 'other-contract',
      status: 'resolved',
      attachment_path: 'other-tenant/secret.pdf',
    } as never, '2026-07-17')

    expect(mocks.resolveHousing).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1',
      '2026-07-17',
    )
    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), {
      tenant_id: 'tenant-1',
      building_id: 'building-1',
      contract_id: 'contract-1',
      title: 'Leaking tap',
      description: 'Water is leaking.',
      attachment_path: null,
    })
  })

  it('stores attachments under the resolved tenant path and returns a signed URL', async () => {
    const svc = await service()
    const data = Buffer.from('photo')

    const result = await svc.create({} as never, tenant, {
      title: 'Leaking tap',
      description: 'Water is leaking.',
      attachment: { name: 'Photo.jpg', mimeType: 'image/jpeg', data },
    }, '2026-07-17')

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^tenant-1\/requests\/[0-9a-f-]{36}\.jpg$/),
      { name: 'Photo.jpg', mimeType: 'image/jpeg', data },
    )
    expect(mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attachment_path: 'tenant-1/requests/uuid.jpg' }),
    )
    expect(result.attachmentSignedUrl).toBe('https://signed.test/attachment')
  })

  it('returns the created request if its preview cannot be signed', async () => {
    mocks.createSignedUrl.mockRejectedValue(new Error('storage unavailable'))
    const result = await (await service()).create({} as never, tenant, {
      title: 'Issue', description: 'Details',
      attachment: { name: 'Photo.jpg', mimeType: 'image/jpeg', data: Buffer.from('photo') },
    })
    expect(result).toMatchObject({ id: stored.id, attachmentSignedUrl: null, attachmentUnavailable: true })
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.auditAppend).toHaveBeenCalledTimes(1)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('rejects creation when the tenant has no active contract context', async () => {
    mocks.resolveHousing.mockResolvedValue(null)
    const svc = await service()

    await expect(svc.create({} as never, tenant, {
      title: 'Issue',
      description: 'Details',
    }, '2026-07-17')).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('rechecks tenant capabilities before resolving self-scope', async () => {
    const svc = await service()

    await expect(svc.list({} as never, admin)).rejects.toMatchObject({ statusCode: 403 })
    await expect(svc.detail({} as never, admin, stored.id)).rejects.toMatchObject({ statusCode: 403 })
    await expect(svc.create({} as never, admin, {
      title: 'Issue', description: 'Details',
    })).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.resolveTenantId).not.toHaveBeenCalled()
  })

  it('appends a create audit event with building context', async () => {
    mocks.create.mockImplementation((_event, input) => Promise.resolve({
      ...stored,
      ...input,
      attachment_path: 'tenant-1/requests/uuid.jpg',
    }))
    const svc = await service()

    await svc.create({} as never, tenant, {
      title: 'Issue',
      description: 'Details',
      attachment: { name: 'Photo.jpg', mimeType: 'image/jpeg', data: Buffer.from('photo') },
    }, '2026-07-17')

    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), tenant, {
      building_id: 'building-1',
      action: 'support_request.created',
      entity_type: 'support_request',
      entity_id: 'request-1',
      after_data: {
        id: 'request-1',
        tenant_id: 'tenant-1',
        building_id: 'building-1',
        contract_id: 'contract-1',
        status: 'new',
        created_at: '2026-07-17T10:00:00.000Z',
        has_attachment: true,
      },
    })
    expect(JSON.stringify(mocks.auditAppend.mock.calls[0])).not.toContain('signed.test')
    expect(JSON.stringify(mocks.auditAppend.mock.calls[0])).not.toContain('attachment_path')
  })
})

describe('TenantSupportRequestService operator hook', () => {
  it('forbids tenant callers before operator reads', async () => {
    await expect((await service()).listForOperator({} as never, tenant)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.listByBuildingIds).not.toHaveBeenCalled()
  })
})
