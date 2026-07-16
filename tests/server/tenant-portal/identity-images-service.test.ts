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

  it('fills or replaces the shared slot and removes the superseded object', async () => {
    const { TenantIdentityImageService } = await import(
      '../../../server/services/tenant-portal/identity-images'
    )
    const data = Buffer.from('jpeg')

    const result = await TenantIdentityImageService.upload(
      {} as never,
      tenantUser,
      'front',
      { mimeType: 'image/jpeg', data },
    )

    const path = mocks.upload.mock.calls[0][1] as string
    expect(path).toMatch(/^tenant-1\/front\/[0-9a-f-]{36}\.jpg$/)
    expect(mocks.updatePath).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'front', path)
    expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), oldPaths.frontPath)
    expect(result).toEqual({ frontSignedUrl: `signed:${path}`, backSignedUrl: null })
    expect(mocks.auditAppend).toHaveBeenCalledWith(
      expect.anything(),
      tenantUser,
      expect.objectContaining({ action: 'tenant.updated', entity_id: 'tenant-1' }),
    )
  })

  it('fills an empty shared slot without attempting to remove an object', async () => {
    mocks.findPaths.mockResolvedValue({ frontPath: null, backPath: null })
    mocks.updatePath.mockImplementation(
      (_event, _tenantId, side: 'front' | 'back', path: string | null) => Promise.resolve({
        frontPath: side === 'front' ? path : null,
        backPath: side === 'back' ? path : null,
      }),
    )
    const { TenantIdentityImageService } = await import(
      '../../../server/services/tenant-portal/identity-images'
    )
    const data = Buffer.from('jpeg')

    const result = await TenantIdentityImageService.upload(
      {} as never,
      tenantUser,
      'back',
      { mimeType: 'image/jpeg', data },
    )

    const path = mocks.upload.mock.calls[0][1] as string
    expect(path).toMatch(/^tenant-1\/back\/[0-9a-f-]{36}\.jpg$/)
    expect(mocks.updatePath).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'back', path)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(result).toEqual({
      frontSignedUrl: null,
      backSignedUrl: `signed:${path}`,
    })
  })

  it('clears the same slot and removes its object', async () => {
    const { TenantIdentityImageService } = await import(
      '../../../server/services/tenant-portal/identity-images'
    )

    await expect(TenantIdentityImageService.remove(
      {} as never,
      tenantUser,
      'front',
    )).resolves.toEqual({ frontSignedUrl: null, backSignedUrl: null })
    expect(mocks.updatePath).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'front', null)
    expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), oldPaths.frontPath)
  })

  it.each([
    ['application/pdf', Buffer.from('pdf'), 'jpeg, png hoặc webp'],
    ['image/jpeg', Buffer.alloc(5 * 1024 * 1024 + 1), '5MB'],
  ])('rejects invalid image %s before storage', async (mimeType, data, message) => {
    const { TenantIdentityImageService } = await import(
      '../../../server/services/tenant-portal/identity-images'
    )

    await expect(TenantIdentityImageService.upload(
      {} as never,
      tenantUser,
      'front',
      { mimeType, data },
    )).rejects.toMatchObject({
      statusCode: 422,
      data: { error: { code: 'VALIDATION_ERROR', message: expect.stringContaining(message) } },
    })
    expect(mocks.upload).not.toHaveBeenCalled()
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
