import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveTenantId: vi.fn(),
  getHeader: vi.fn(),
  parseBody: vi.fn(),
  readMultipartFormData: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
}))

vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  readMultipartFormData: mocks.readMultipartFormData,
}))
vi.mock('../../../server/services/tenant-portal/requests', () => ({
  TenantSupportRequestService: {
    list: mocks.list,
    create: mocks.create,
  },
}))

const user = { id: 'auth-tenant', app_metadata: { role: 'tenant' } }
const created = { id: 'request-1', status: 'new' }

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('resolveTenantId', mocks.resolveTenantId)
vi.stubGlobal('getHeader', mocks.getHeader)
vi.stubGlobal('parseBody', mocks.parseBody)
vi.stubGlobal('throwValidationError', (message: string, details?: unknown) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message, details } } }
})

describe('tenant support request API handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(user)
    mocks.resolveTenantId.mockResolvedValue('tenant-1')
    mocks.getHeader.mockReturnValue('application/json')
    mocks.parseBody.mockResolvedValue({ title: 'Issue', description: 'Details' })
    mocks.list.mockResolvedValue([created])
    mocks.create.mockResolvedValue(created)
    mocks.readMultipartFormData.mockResolvedValue([])
  })

  it('lists the caller requests in the standard data envelope', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/requests/index.get'
    )

    await expect(handler({} as never)).resolves.toEqual({ data: [created] })
    expect(mocks.resolveTenantId).toHaveBeenCalledWith(expect.anything(), user)
    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), user)
  })

  it('accepts JSON content when no attachment is provided', async () => {
    const { default: handler } = await import(
      '../../../server/api/tenant/requests/index.post'
    )

    await expect(handler({} as never)).resolves.toEqual({ data: created })
    expect(mocks.parseBody).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ safeParse: expect.any(Function) }),
    )
    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), user, {
      title: 'Issue',
      description: 'Details',
    })
  })

  it('accepts multipart content with an optional attachment', async () => {
    mocks.getHeader.mockReturnValue('multipart/form-data; boundary=test')
    mocks.readMultipartFormData.mockResolvedValue([
      { name: 'title', data: Buffer.from('Issue') },
      { name: 'description', data: Buffer.from('Details') },
      {
        name: 'attachment',
        filename: 'photo.jpg',
        type: 'image/jpeg',
        data: Buffer.from('photo'),
      },
    ])
    const { default: handler } = await import(
      '../../../server/api/tenant/requests/index.post'
    )

    await handler({} as never)

    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), user, {
      title: 'Issue',
      description: 'Details',
      attachment: {
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        data: Buffer.from('photo'),
      },
    })
  })

  it('rejects invalid multipart content before calling the service', async () => {
    mocks.getHeader.mockReturnValue('multipart/form-data; boundary=test')
    mocks.readMultipartFormData.mockResolvedValue([
      { name: 'description', data: Buffer.from('Details') },
    ])
    const { default: handler } = await import(
      '../../../server/api/tenant/requests/index.post'
    )

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 422,
      data: { error: { code: 'VALIDATION_ERROR' } },
    })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
