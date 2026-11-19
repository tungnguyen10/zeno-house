import { beforeEach, describe, expect, it, vi } from 'vitest'

const h3 = vi.hoisted(() => ({
  getHeader: vi.fn(),
  readMultipartFormData: vi.fn(),
  setResponseHeader: vi.fn(),
}))
vi.mock('h3', async importOriginal => ({ ...(await importOriginal<typeof import('h3')>()), ...h3 }))

const service = vi.hoisted(() => ({ extract: vi.fn() }))
vi.mock('../../../server/services/identity/extraction', () => ({ IdentityExtractionService: service }))

const g = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', g.requireAuth)
vi.stubGlobal('throwValidationError', (message: string) => {
  throw Object.assign(new Error(message), { statusCode: 422 })
})

const user = { id: 'user-1', app_metadata: { role: 'owner' } }

beforeEach(() => {
  vi.clearAllMocks()
  g.requireAuth.mockResolvedValue(user)
  h3.getHeader.mockReturnValue('1000')
})

async function handler() {
  return (await import('../../../server/api/identity/extract.post')).default as (event: unknown) => Promise<unknown>
}

describe('POST /api/identity/extract', () => {
  it('passes the purpose and only image parts to the service and returns the envelope with no-store', async () => {
    h3.readMultipartFormData.mockResolvedValue([
      { name: 'purpose', data: Buffer.from('lessor') },
      { name: 'images[]', data: Buffer.from('a'), filename: 'a.jpg', type: 'image/jpeg' },
      { name: 'other', data: Buffer.from('x') },
      { name: 'images[]', data: Buffer.alloc(0) },
    ])
    service.extract.mockResolvedValue({ suggestion: { needs_review: true }, model: 'm' })
    const event = {}
    const result = await (await handler())(event)
    expect(service.extract).toHaveBeenCalledWith(event, user, 'lessor', [{ data: Buffer.from('a'), filename: 'a.jpg', type: 'image/jpeg' }])
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

  it.each([
    ['missing', []],
    ['unknown', [{ name: 'purpose', data: Buffer.from('contract') }]],
  ])('rejects a %s purpose with 422 before calling the service', async (_name, form) => {
    h3.readMultipartFormData.mockResolvedValue([
      ...form,
      { name: 'images[]', data: Buffer.from('a'), filename: 'a.jpg', type: 'image/jpeg' },
    ])
    await expect((await handler())({})).rejects.toMatchObject({ statusCode: 422 })
    expect(service.extract).not.toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    g.requireAuth.mockRejectedValue({ statusCode: 401 })
    await expect((await handler())({})).rejects.toMatchObject({ statusCode: 401 })
    expect(service.extract).not.toHaveBeenCalled()
  })
})
