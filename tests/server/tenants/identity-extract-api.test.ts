import { beforeEach, describe, expect, it, vi } from 'vitest'

const h3 = vi.hoisted(() => ({
  getHeader: vi.fn(),
  readMultipartFormData: vi.fn(),
  setResponseHeader: vi.fn(),
}))
vi.mock('h3', async importOriginal => ({ ...(await importOriginal<typeof import('h3')>()), ...h3 }))

const service = vi.hoisted(() => ({ extract: vi.fn() }))
vi.mock('../../../server/services/tenants/identity-extraction', () => ({ TenantIdentityExtractionService: service }))

const g = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', g.requireAuth)

const user = { id: 'user-1', app_metadata: { role: 'owner' } }

beforeEach(() => {
  vi.clearAllMocks()
  g.requireAuth.mockResolvedValue(user)
  h3.getHeader.mockReturnValue('1000')
})

async function handler() {
  return (await import('../../../server/api/tenants/identity/extract.post')).default as (event: unknown) => Promise<unknown>
}

describe('POST /api/tenants/identity/extract', () => {
  it('passes only image parts to the service and returns the envelope with no-store', async () => {
    h3.readMultipartFormData.mockResolvedValue([
      { name: 'images[]', data: Buffer.from('a'), filename: 'a.jpg', type: 'image/jpeg' },
      { name: 'other', data: Buffer.from('x') },
      { name: 'images[]', data: Buffer.alloc(0) },
    ])
    service.extract.mockResolvedValue({ suggestion: { needs_review: true }, model: 'm' })
    const event = {}
    const result = await (await handler())(event)
    expect(service.extract).toHaveBeenCalledWith(event, user, [{ data: Buffer.from('a'), filename: 'a.jpg', type: 'image/jpeg' }])
    expect(result).toEqual({ data: { needs_review: true }, meta: { model: 'm' } })
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
  })

  it('rejects an oversized body with 413 before reading it', async () => {
    h3.getHeader.mockReturnValue(String(13 * 1024 * 1024))
    const error = await (await handler())({}).catch((e: unknown) => e)
    expect(error).toMatchObject({ statusCode: 413 })
    expect(h3.readMultipartFormData).not.toHaveBeenCalled()
    expect(service.extract).not.toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    g.requireAuth.mockRejectedValue({ statusCode: 401 })
    await expect((await handler())({})).rejects.toMatchObject({ statusCode: 401 })
    expect(service.extract).not.toHaveBeenCalled()
  })
})
