import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  storageFrom: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  createSignedUrl: vi.fn(),
  tenantResults: [] as Array<{ data: unknown; error: unknown }>,
  tenantCalls: [] as Array<{ method: string; args: unknown[] }>,
}))

vi.mock('../../../server/utils/db', () => ({ db: mocks.db }))

function tenantQuery(result: { data: unknown; error: unknown }) {
  const query = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') {
        return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      }
      return (...args: unknown[]) => {
        mocks.tenantCalls.push({ method: String(property), args })
        if (property === 'maybeSingle' || property === 'single') return Promise.resolve(result)
        return query
      }
    },
  })
  return query
}

describe('TenantIdentityImageRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tenantCalls.length = 0
    mocks.tenantResults.length = 0
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
      remove: mocks.storageRemove,
      createSignedUrl: mocks.createSignedUrl,
    })
    mocks.db.mockReturnValue({
      from: vi.fn(() => tenantQuery(mocks.tenantResults.shift() ?? { data: null, error: null })),
      storage: { from: mocks.storageFrom },
    })
    mocks.storageUpload.mockResolvedValue({ data: { path: 'tenant-1/front/new.jpg' }, error: null })
    mocks.storageRemove.mockResolvedValue({ data: [], error: null })
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.test/id' }, error: null })
  })

  it('reads only the two identity paths by resolved tenant id', async () => {
    mocks.tenantResults.push({
      data: { id_card_front_path: 'tenant-1/front/old.jpg', id_card_back_path: null },
      error: null,
    })
    const { TenantIdentityImageRepository } = await import(
      '../../../server/repositories/tenant-portal/identity-images'
    )

    await expect(TenantIdentityImageRepository.findPaths({} as never, 'tenant-1')).resolves.toEqual({
      frontPath: 'tenant-1/front/old.jpg',
      backPath: null,
    })
    expect(mocks.tenantCalls).toEqual(expect.arrayContaining([
      { method: 'select', args: ['id_card_front_path, id_card_back_path'] },
      { method: 'eq', args: ['id', 'tenant-1'] },
    ]))
  })

  it('updates exactly one existing identity slot', async () => {
    mocks.tenantResults.push({
      data: { id_card_front_path: 'tenant-1/front/new.jpg', id_card_back_path: null },
      error: null,
    })
    const { TenantIdentityImageRepository } = await import(
      '../../../server/repositories/tenant-portal/identity-images'
    )

    await TenantIdentityImageRepository.updatePath(
      {} as never,
      'tenant-1',
      'front',
      'tenant-1/front/new.jpg',
    )

    expect(mocks.tenantCalls).toContainEqual({
      method: 'update',
      args: [{ id_card_front_path: 'tenant-1/front/new.jpg' }],
    })
    expect(mocks.tenantCalls).toContainEqual({ method: 'eq', args: ['id', 'tenant-1'] })
  })

  it('uploads, removes, and signs exact paths in the shared identity bucket', async () => {
    const { TenantIdentityImageRepository } = await import(
      '../../../server/repositories/tenant-portal/identity-images'
    )
    const data = Buffer.from('image')

    await expect(TenantIdentityImageRepository.upload(
      {} as never,
      'tenant-1/front/new.jpg',
      { mimeType: 'image/jpeg', data },
    )).resolves.toBe('tenant-1/front/new.jpg')
    await TenantIdentityImageRepository.remove({} as never, 'tenant-1/front/old.jpg')
    await expect(TenantIdentityImageRepository.createSignedUrl(
      {} as never,
      'tenant-1/front/new.jpg',
    )).resolves.toBe('https://signed.test/id')

    expect(mocks.storageFrom).toHaveBeenCalledWith('tenant-id-images')
    expect(mocks.storageUpload).toHaveBeenCalledWith('tenant-1/front/new.jpg', data, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    expect(mocks.storageRemove).toHaveBeenCalledWith(['tenant-1/front/old.jpg'])
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('tenant-1/front/new.jpg', 300)
  })
})
