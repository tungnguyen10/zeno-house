import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveTenantId: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  readMultipartFormData: vi.fn(),
  setResponseStatus: vi.fn(),
}))

vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  readMultipartFormData: mocks.readMultipartFormData,
}))
vi.mock('../../../server/services/tenant-portal/documents', () => ({
  TenantDocumentService: {
    list: mocks.list,
    upload: mocks.upload,
    remove: mocks.remove,
  },
}))

type MockEvent = { context: { params?: Record<string, string> } }
const user = { id: 'auth-tenant', app_metadata: { role: 'tenant' } }

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('resolveTenantId', mocks.resolveTenantId)
vi.stubGlobal('getRouterParam', (event: MockEvent, key: string) => event.context.params?.[key])
vi.stubGlobal('setResponseStatus', mocks.setResponseStatus)
vi.stubGlobal('throwValidationError', (message: string) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message } } }
})

function event(params?: Record<string, string>): MockEvent {
  return { context: { params } }
}

describe('tenant document API handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(user)
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.list.mockResolvedValue([{ id: 'object-1' }])
    mocks.upload.mockResolvedValue({ id: 'object-2' })
    mocks.remove.mockResolvedValue(undefined)
    mocks.readMultipartFormData.mockResolvedValue([{
      name: 'document',
      filename: 'Giấy tờ.pdf',
      type: 'application/pdf',
      data: Buffer.from('pdf'),
    }])
  })

  it('lists scoped documents in the standard data envelope', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/documents/index.get'
    )

    await expect(handler(event() as never)).resolves.toEqual({ data: [{ id: 'object-1' }] })
    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), user)
    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), user)
  })

  it('passes one multipart document to the scoped service', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/documents/index.post'
    )

    await expect(handler(event() as never)).resolves.toEqual({ data: { id: 'object-2' } })
    expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), user, {
      name: 'Giấy tờ.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('pdf'),
    })
  })

  it('rejects a multipart request without a document', async () => {
    mocks.readMultipartFormData.mockResolvedValue([])
    const { default: handler } = await import(
      '../../../server/api/tenant/documents/index.post'
    )

    await expect(handler(event() as never)).rejects.toMatchObject({
      statusCode: 422,
      data: { error: { code: 'VALIDATION_ERROR' } },
    })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('deletes the scoped object and returns no content', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/documents/[id].delete'
    )
    const requestEvent = event({ id: 'object-1' })

    await expect(handler(requestEvent as never)).resolves.toBeUndefined()
    expect(mocks.remove).toHaveBeenCalledWith(requestEvent, user, 'object-1')
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(requestEvent, 204)
  })
})
