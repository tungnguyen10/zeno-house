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

  it.each(['post', 'delete'] as const)('denies %s before parsing or invoking image mutations', async (method) => {
    const handler = method === 'post'
      ? (await import('../../../server/api/tenant/id-images/[side].post')).default
      : (await import('../../../server/api/tenant/id-images/[side].delete')).default
    await expect(handler(event({ side: 'invalid' }) as never)).rejects.toMatchObject({
      statusCode: 403, data: { error: { code: 'FORBIDDEN' } },
    })
    expect(mocks.requireAuth).toHaveBeenCalled()
    expect(mocks.resolveTenantId).toHaveBeenCalled()
    expect(mocks.readMultipartFormData).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
