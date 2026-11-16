import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' })

async function load() {
  const { useTenantIdentityExtract } = await import('~/composables/tenants/useTenantIdentityExtract')
  return useTenantIdentityExtract()
}

describe('useTenantIdentityExtract', () => {
  it('posts the images as multipart and returns the suggestion', async () => {
    fetchMock.mockResolvedValue({ data: { needs_review: true }, meta: { model: 'm' } })
    const api = await load()
    const result = await api.extract([file('a.jpg'), file('b.jpg')])
    expect(result).toEqual({ needs_review: true })
    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string, body: FormData, signal: AbortSignal, timeout: number }]
    expect(url).toBe('/api/tenants/identity/extract')
    expect(options.method).toBe('POST')
    expect(options.body.getAll('images[]')).toHaveLength(2)
    expect(options.timeout).toBeGreaterThan(30_000)
    expect(api.error.value).toBeNull()
    expect(api.loading.value).toBe(false)
  })

  it('exposes loading while the request is in flight', async () => {
    let resolve: (value: unknown) => void = () => {}
    fetchMock.mockReturnValue(new Promise((r) => { resolve = r }))
    const api = await load()
    const pending = api.extract([file('a.jpg')])
    expect(api.loading.value).toBe(true)
    resolve({ data: { needs_review: true } })
    await pending
    expect(api.loading.value).toBe(false)
  })

  it('returns null with the server message on failure', async () => {
    fetchMock.mockRejectedValue({ statusCode: 429, data: { error: { code: 'TENANT_OCR_QUOTA', message: 'Đã hết lượt đọc ảnh hôm nay. Vui lòng nhập tay.' } } })
    const api = await load()
    expect(await api.extract([file('a.jpg')])).toBeNull()
    expect(api.error.value).toBe('Đã hết lượt đọc ảnh hôm nay. Vui lòng nhập tay.')
  })

  it('does not report an error when aborted', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const api = await load()
    expect(await api.extract([file('a.jpg')])).toBeNull()
    expect(api.error.value).toBeNull()
  })

  it('aborts the request signal on abort()', async () => {
    let signal: AbortSignal | undefined
    fetchMock.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      signal = options.signal
      return new Promise(() => undefined)
    })
    const api = await load()
    void api.extract([file('a.jpg')])
    api.abort()
    expect(signal?.aborted).toBe(true)
    expect(api.loading.value).toBe(false)
  })

  it('never writes to localStorage or sessionStorage', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem')
    fetchMock.mockResolvedValue({ data: { needs_review: true } })
    const api = await load()
    await api.extract([file('a.jpg')])
    expect(local).not.toHaveBeenCalled()
    local.mockRestore()
  })
})
