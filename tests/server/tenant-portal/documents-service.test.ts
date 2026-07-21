import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  auditAppend: vi.fn(),
  findActiveContract: vi.fn(),
}))

vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: mocks.resolveTenantId }))
vi.mock('../../../server/repositories/tenant-portal/documents', () => ({
  TenantDocumentRepository: {
    list: mocks.list,
    upload: mocks.upload,
    remove: mocks.remove,
    createSignedUrl: mocks.createSignedUrl,
  },
}))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: mocks.auditAppend } }))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: { findActiveByTenantId: mocks.findActiveContract } }))

const tenantUser = { id: 'auth-tenant', app_metadata: { role: 'tenant' } } as never
const internalUser = { id: 'auth-admin', app_metadata: { role: 'admin' } } as never
const existing = {
  id: 'object-1',
  path: 'tenant-1/existing.pdf',
  name: 'Existing.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  createdAt: '2026-07-16T12:00:00.000Z',
}

describe('TenantDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.list.mockResolvedValue([existing])
    mocks.upload.mockResolvedValue({
      id: 'object-2',
      path: 'tenant-1/uuid-1.pdf',
    })
    mocks.remove.mockResolvedValue(undefined)
    mocks.createSignedUrl.mockResolvedValue('https://signed.test/document')
    mocks.findActiveContract.mockResolvedValue({ buildingId: 'building-1' })
  })

  it('lists only the resolved tenant documents with short-lived signed URLs', async () => {
    const { TenantDocumentService } = await import(
      '../../../server/services/tenant-portal/documents'
    )

    await expect(TenantDocumentService.list({} as never, tenantUser)).resolves.toEqual([{
      id: 'object-1',
      name: 'Existing.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      createdAt: '2026-07-16T12:00:00.000Z',
      signedUrl: 'https://signed.test/document',
    }])
    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), tenantUser)
    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), 'tenant-1')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(expect.anything(), existing.path)
  })

  it('builds upload paths from the resolved tenant id only', async () => {
    const { TenantDocumentService } = await import(
      '../../../server/services/tenant-portal/documents'
    )
    const data = Buffer.from('pdf')

    const result = await TenantDocumentService.upload({} as never, tenantUser, {
      name: 'Giấy tờ.pdf',
      mimeType: 'application/pdf',
      data,
    })

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^tenant-1\/[0-9a-f-]{36}\.pdf$/),
      { name: 'Giấy tờ.pdf', mimeType: 'application/pdf', data },
    )
    expect(result).toMatchObject({
      id: 'object-2',
      name: 'Giấy tờ.pdf',
      mimeType: 'application/pdf',
      size: data.length,
      signedUrl: 'https://signed.test/document',
    })
    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), tenantUser, expect.objectContaining({
      action: 'tenant_document.uploaded', entity_type: 'tenant_document', entity_id: 'object-2',
      building_id: 'building-1',
      after_data: { id: 'object-2', name: 'Giấy tờ.pdf', mime_type: 'application/pdf', size: data.length },
    }))
    expect(JSON.stringify(mocks.auditAppend.mock.calls[0])).not.toContain('signed.test')
    expect(mocks.auditAppend.mock.calls[0]?.[2]).not.toHaveProperty('after_data.data')
  })

  it.each([
    ['text/plain', Buffer.from('invalid'), 'jpeg, png, webp hoặc pdf'],
    ['application/pdf', Buffer.alloc(5 * 1024 * 1024 + 1), '5MB'],
  ])('rejects invalid upload %s before storage', async (mimeType, data, message) => {
    const { TenantDocumentService } = await import(
      '../../../server/services/tenant-portal/documents'
    )

    await expect(TenantDocumentService.upload({} as never, tenantUser, {
      name: 'document', mimeType, data,
    })).rejects.toMatchObject({
      statusCode: 422,
      data: { error: { code: 'VALIDATION_ERROR', message: expect.stringContaining(message) } },
    })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('returns not found for a document outside the resolved tenant prefix', async () => {
    mocks.list.mockResolvedValue([])
    const { TenantDocumentService } = await import(
      '../../../server/services/tenant-portal/documents'
    )

    await expect(TenantDocumentService.remove(
      {} as never,
      tenantUser,
      'other-tenant-object',
    )).rejects.toMatchObject({ statusCode: 404, data: { error: { code: 'NOT_FOUND' } } })
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('audits removal without persisting the storage path', async () => {
    const { TenantDocumentService } = await import('../../../server/services/tenant-portal/documents')

    await TenantDocumentService.remove({} as never, tenantUser, 'object-1')

    expect(mocks.auditAppend).toHaveBeenCalledWith(expect.anything(), tenantUser, expect.objectContaining({
      action: 'tenant_document.removed', entity_type: 'tenant_document', entity_id: 'object-1',
      building_id: 'building-1',
      before_data: { id: 'object-1', name: 'Existing.pdf', mime_type: 'application/pdf', size: 2048, created_at: existing.createdAt },
    }))
    expect(JSON.stringify(mocks.auditAppend.mock.calls[0])).not.toContain(existing.path)
  })

  it('rechecks tenant document capabilities before resolving scope', async () => {
    const { TenantDocumentService } = await import(
      '../../../server/services/tenant-portal/documents'
    )

    await expect(TenantDocumentService.list({} as never, internalUser))
      .rejects.toMatchObject({ statusCode: 403 })
    await expect(TenantDocumentService.upload({} as never, internalUser, {
      name: 'document.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf'),
    })).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.resolveTenantId).not.toHaveBeenCalled()
  })
})
