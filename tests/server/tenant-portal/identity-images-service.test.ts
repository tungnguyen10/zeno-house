import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  findPaths: vi.fn(),
  updatePath: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  auditAppend: vi.fn(),
}))

vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: mocks.resolveTenantId }))
vi.mock('../../../server/repositories/tenant-portal/identity-images', () => ({
  TenantIdentityImageRepository: {
    findPaths: mocks.findPaths,
    updatePath: mocks.updatePath,
    upload: mocks.upload,
    remove: mocks.remove,
    createSignedUrl: mocks.createSignedUrl,
  },
}))
vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: mocks.auditAppend },
}))

const tenantUser = { id: 'auth-tenant', app_metadata: { role: 'tenant' } } as never
const internalUser = { id: 'auth-admin', app_metadata: { role: 'admin' } } as never
const oldPaths = { frontPath: 'tenant-1/front/old.jpg', backPath: null }

describe('TenantIdentityImageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.findPaths.mockResolvedValue(oldPaths)
    mocks.updatePath.mockImplementation(
      (_event, _tenantId, side: 'front' | 'back', path: string | null) => Promise.resolve({
        frontPath: side === 'front' ? path : oldPaths.frontPath,
        backPath: side === 'back' ? path : oldPaths.backPath,
      }),
    )
    mocks.upload.mockImplementation((_event, path: string) => Promise.resolve(path))
    mocks.remove.mockResolvedValue(undefined)
    mocks.createSignedUrl.mockImplementation((_event, path: string) => Promise.resolve(`signed:${path}`))
    mocks.auditAppend.mockResolvedValue(undefined)
  })

  it('returns signed URLs for the resolved tenant slots only', async () => {
    const { TenantIdentityImageService } = await import(
      '../../../server/services/tenant-portal/identity-images'
    )

    await expect(TenantIdentityImageService.get({} as never, tenantUser)).resolves.toEqual({
      frontSignedUrl: 'signed:tenant-1/front/old.jpg',
      backSignedUrl: null,
    })
    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), tenantUser)
    expect(mocks.findPaths).toHaveBeenCalledWith(expect.anything(), 'tenant-1')
  })

  it.each(['upload', 'remove'] as const)('denies direct %s before parsing, reads, storage, paths or audits', async (operation) => {
    const { TenantIdentityImageService } = await import('../../../server/services/tenant-portal/identity-images')
    const request = operation === 'upload'
      ? TenantIdentityImageService.upload({} as never, tenantUser, 'front', { mimeType: 'invalid', data: Buffer.alloc(0) })
      : TenantIdentityImageService.remove({} as never, tenantUser, 'front')
    await expect(request).rejects.toMatchObject({ statusCode: 403, data: { error: { code: 'FORBIDDEN' } } })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.updatePath).not.toHaveBeenCalled()
    expect(mocks.findPaths).not.toHaveBeenCalled()
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
    expect(mocks.auditAppend).not.toHaveBeenCalled()
  })

  it('rejects non-tenant capabilities before resolving any tenant scope', async () => {
    const { TenantIdentityImageService } = await import(
      '../../../server/services/tenant-portal/identity-images'
    )

    await expect(TenantIdentityImageService.get({} as never, internalUser))
      .rejects.toMatchObject({ statusCode: 403 })
    await expect(TenantIdentityImageService.upload(
      {} as never,
      internalUser,
      'front',
      { mimeType: 'image/jpeg', data: Buffer.from('jpeg') },
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.resolveTenantId).not.toHaveBeenCalled()
  })
})
