import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = {
  list: vi.fn(), check: vi.fn(), preview: vi.fn(), issue: vi.fn(),
  download: vi.fn(), readiness: vi.fn(), regenerate: vi.fn(), sign: vi.fn(), void: vi.fn(),
}
const requireAuth = vi.fn()
vi.mock('../../../server/services/contract-documents', () => ({ ContractDocumentService: svc }))
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('requireAuth', requireAuth)
vi.stubGlobal('getRouterParam', (_e: unknown, key: string) => (key === 'docId' ? 'doc-1' : 'c-1'))
vi.stubGlobal('setResponseStatus', () => {})
const headers: Record<string, string> = {}
vi.stubGlobal('setHeader', (_e: unknown, k: string, v: string) => { headers[k] = v })

function makeEvent(body?: unknown) {
  return { context: { body } } as never
}
vi.stubGlobal('readBody', async (e: { context: { body?: unknown } }) => e.context.body)

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
})

describe('contract documents API', () => {
  it('GET list wraps the service DTOs', async () => {
    svc.list.mockResolvedValue([{ id: 'd-1' }])
    const { default: handler } = await import('../../../server/api/contracts/[id]/documents/index.get')
    await expect(handler(makeEvent())).resolves.toEqual({ data: [{ id: 'd-1' }] })
    expect(svc.list).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'c-1')
  })

  it('POST issue validates and wraps', async () => {
    svc.issue.mockResolvedValue({ id: 'd-1' })
    const { default: handler } = await import('../../../server/api/contracts/[id]/documents/index.post')
    const res = await handler(makeEvent({ type: 'contract', signed_date: '2026-11-12', request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f' })) as { data: unknown }
    expect(res.data).toEqual({ id: 'd-1' })
  })

  it('POST preview returns the docx buffer with a Content-Disposition header', async () => {
    svc.preview.mockResolvedValue(Buffer.from('docx'))
    const { default: handler } = await import('../../../server/api/contracts/[id]/documents/preview.post')
    const out = await handler(makeEvent({ type: 'contract', signed_date: '2026-11-12' })) as Buffer
    expect(Buffer.isBuffer(out)).toBe(true)
    expect(headers['Content-Disposition']).toContain('.docx')
  })

  it('GET download wraps the signed url', async () => {
    svc.download.mockResolvedValue({ url: 'https://x', expiresIn: 60 })
    const { default: handler } = await import('../../../server/api/contract-documents/[docId]/download.get')
    await expect(handler(makeEvent())).resolves.toEqual({ data: { url: 'https://x', expiresIn: 60 } })
    expect(svc.download).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'doc-1')
  })

  it('POST void rejects a too-short reason with 422', async () => {
    const { default: handler } = await import('../../../server/api/contract-documents/[docId]/void.post')
    await expect(Promise.resolve(handler(makeEvent({ reason: 'ngắn' })))).rejects.toMatchObject({ statusCode: 422 })
    expect(svc.void).not.toHaveBeenCalled()
  })
})
