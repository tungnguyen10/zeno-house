import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  getAssignedBuildingIds: vi.fn(),
  listByTenantId: vi.fn(),
  findActiveContractContext: vi.fn(),
  create: vi.fn(),
  listByBuildingIds: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  auditAppend: vi.fn(),
}))

vi.mock('../../../server/utils/scope', () => ({
  resolveTenantId: mocks.resolveTenantId,
  getAssignedBuildingIds: mocks.getAssignedBuildingIds,
}))
vi.mock('../../../server/repositories/tenant-portal/requests', () => ({
  TenantSupportRequestRepository: {
    listByTenantId: mocks.listByTenantId,
    findActiveContractContext: mocks.findActiveContractContext,
    create: mocks.create,
    listByBuildingIds: mocks.listByBuildingIds,
  },
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
const owner = { id: 'auth-owner', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'auth-manager', app_metadata: { role: 'manager' } } as AuthUser
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
  mocks.getAssignedBuildingIds.mockResolvedValue(['building-1'])
  mocks.listByTenantId.mockResolvedValue([stored])
  mocks.findActiveContractContext.mockResolvedValue({
    contractId: 'contract-1',
    buildingId: 'building-1',
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
    mocks.listByTenantId.mockResolvedValue([{
      ...stored,
      attachment_path: 'tenant-1/requests/request-1/photo.jpg',
    }])
    const svc = await service()

    const result = await svc.list({} as never, tenant)

    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), tenant)
    expect(mocks.listByTenantId).toHaveBeenCalledWith(expect.anything(), 'tenant-1')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1/requests/request-1/photo.jpg',
    )
    expect(result[0]).toMatchObject({
      id: 'request-1',
      tenantId: 'tenant-1',
      status: 'new',
      attachmentSignedUrl: 'https://signed.test/attachment',
    })
  })

  it('refuses to sign an attachment path outside the stored tenant request prefix', async () => {
    mocks.listByTenantId.mockResolvedValue([{
      ...stored,
      attachment_path: 'tenant-2/requests/secret.pdf',
    }])
    const svc = await service()

    await expect(svc.list({} as never, tenant)).rejects.toMatchObject({
      statusCode: 500,
      data: { error: { code: 'INTERNAL' } },
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
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

    expect(mocks.findActiveContractContext).toHaveBeenCalledWith(
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

  it('rejects creation when the tenant has no active contract context', async () => {
    mocks.findActiveContractContext.mockResolvedValue(null)
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
        title: 'Issue',
        description: 'Details',
        status: 'new',
        created_at: '2026-07-17T10:00:00.000Z',
        has_attachment: true,
      },
    })
    expect(JSON.stringify(mocks.auditAppend.mock.calls[0])).not.toContain('signed.test')
    expect(JSON.stringify(mocks.auditAppend.mock.calls[0])).not.toContain('attachment_path')
  })
})

describe('TenantSupportRequestService operator scope', () => {
  it.each([owner, manager])('uses assigned building ids for $app_metadata.role reads', async (user) => {
    const svc = await service()

    await svc.listForOperator({ context: {} } as never, user)

    expect(mocks.getAssignedBuildingIds).toHaveBeenCalledWith(expect.anything(), user)
    expect(mocks.listByBuildingIds).toHaveBeenCalledWith(expect.anything(), ['building-1'])
  })

  it('passes null scope for an unscoped admin', async () => {
    mocks.getAssignedBuildingIds.mockResolvedValue(null)
    const svc = await service()

    await svc.listForOperator({ context: {} } as never, admin)

    expect(mocks.listByBuildingIds).toHaveBeenCalledWith(expect.anything(), null)
  })

  it('forbids tenant callers from the operator read hook', async () => {
    const svc = await service()

    await expect(svc.listForOperator({ context: {} } as never, tenant))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.getAssignedBuildingIds).not.toHaveBeenCalled()
  })
})
