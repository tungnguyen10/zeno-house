import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveTenantId: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  readMultipartFormData: vi.fn(),
}))

vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  readMultipartFormData: mocks.readMultipartFormData,
}))
vi.mock('../../../server/services/tenant-portal/identity-images', () => ({
  TenantIdentityImageService: {
    get: mocks.get,
    upload: mocks.upload,
    remove: mocks.remove,
  },
}))

type MockEvent = { context: { params?: Record<string, string> } }
const user = { id: 'auth-tenant', app_metadata: { role: 'tenant' } }
const images = { frontSignedUrl: 'https://signed.test/front', backSignedUrl: null }

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('resolveTenantId', mocks.resolveTenantId)
vi.stubGlobal('getRouterParam', (event: MockEvent, key: string) => event.context.params?.[key])
vi.stubGlobal('throwValidationError', (message: string) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message } } }
})

function event(params?: Record<string, string>): MockEvent {
  return { context: { params } }
}

describe('tenant identity-image API handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(user)
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.get.mockResolvedValue(images)
    mocks.upload.mockResolvedValue(images)
    mocks.remove.mockResolvedValue(images)
    mocks.readMultipartFormData.mockResolvedValue([{
      name: 'image',
      filename: 'front.jpg',
      type: 'image/jpeg',
      data: Buffer.from('jpeg'),
    }])
  })

  it('returns the resolved tenant identity slots', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/id-images/index.get'
    )

    await expect(handler(event() as never)).resolves.toEqual({ data: images })
    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), user)
    expect(mocks.get).toHaveBeenCalledWith(expect.anything(), user)
  })

  it('uploads one validated side without accepting a tenant id', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/id-images/[side].post'
    )
    const requestEvent = event({ side: 'front' })

    await expect(handler(requestEvent as never)).resolves.toEqual({ data: images })
    expect(mocks.upload).toHaveBeenCalledWith(requestEvent, user, 'front', {
      mimeType: 'image/jpeg',
      data: Buffer.from('jpeg'),
    })
  })

  it.each([
    [{ side: 'middle' }, 'invalid side'],
    [{ side: 'front' }, 'missing image'],
  ])('rejects %s before identity mutation', async (params, reason) => {
    if (reason === 'missing image') mocks.readMultipartFormData.mockResolvedValue([])
    const { default: handler } = await import(
      '../../../server/api/tenant/id-images/[side].post'
    )

    await expect(handler(event(params) as never)).rejects.toMatchObject({
      statusCode: 422,
      data: { error: { code: 'VALIDATION_ERROR' } },
    })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('removes one validated side and returns the remaining slots', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/id-images/[side].delete'
    )
    const requestEvent = event({ side: 'back' })

    await expect(handler(requestEvent as never)).resolves.toEqual({ data: images })
    expect(mocks.remove).toHaveBeenCalledWith(requestEvent, user, 'back')
  })

  it('rejects an invalid delete side', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/id-images/[side].delete'
    )

    await expect(handler(event({ side: 'other' }) as never)).rejects.toMatchObject({
      statusCode: 422,
      data: { error: { code: 'VALIDATION_ERROR' } },
    })
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
