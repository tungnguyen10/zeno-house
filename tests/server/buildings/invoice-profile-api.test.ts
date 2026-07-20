import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getRouterParam: vi.fn(),
  readMultipartFormData: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
}))

vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  readMultipartFormData: mocks.readMultipartFormData,
}))
vi.mock('../../../server/services/buildings/invoice-profile', () => ({
  BuildingInvoiceProfileService: { get: mocks.get, save: mocks.save },
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('getRouterParam', mocks.getRouterParam)
vi.stubGlobal('throwValidationError', (message: string, details?: unknown) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message, details } } }
})

describe('building invoice profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'owner-1', app_metadata: { role: 'owner' } })
    mocks.getRouterParam.mockReturnValue('zeno')
    mocks.get.mockResolvedValue(null)
    mocks.save.mockResolvedValue({ buildingId: 'building-1' })
  })

  it('returns the nullable profile in a standard envelope', async () => {
    const { default: handler } = await import(
      '../../../server/api/buildings/[id]/invoice-profile/index.get'
    )

    await expect(handler({} as never)).resolves.toEqual({ data: null })
    expect(mocks.get).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'zeno')
  })

  it('parses text, QR, logo, and logo-reset intent from multipart data', async () => {
    const qr = Buffer.from('qr')
    const logo = Buffer.from('logo')
    mocks.readMultipartFormData.mockResolvedValue([
      { name: 'bank_name', data: Buffer.from('VIB') },
      { name: 'account_holder', data: Buffer.from('NGUYỄN TUẤN ANH') },
      { name: 'account_number', data: Buffer.from('375675817') },
      { name: 'transfer_content_template', data: Buffer.from('{invoice_code}-{room_number}') },
      { name: 'remove_logo', data: Buffer.from('true') },
      { name: 'qr_image', filename: 'qr.webp', type: 'image/webp', data: qr },
      { name: 'logo_image', filename: 'logo.png', type: 'image/png', data: logo },
    ])
    const { default: handler } = await import(
      '../../../server/api/buildings/[id]/invoice-profile/index.put'
    )

    await handler({} as never)

    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'zeno', {
      fields: {
        bank_name: 'VIB',
        account_holder: 'NGUYỄN TUẤN ANH',
        account_number: '375675817',
        transfer_content_template: '{invoice_code}-{room_number}',
      },
      removeLogo: true,
      qrImage: { filename: 'qr.webp', type: 'image/webp', data: qr },
      logoImage: { filename: 'logo.png', type: 'image/png', data: logo },
    })
  })

  it('rejects malformed multipart fields before calling the service', async () => {
    mocks.readMultipartFormData.mockResolvedValue([
      { name: 'bank_name', data: Buffer.from('VIB') },
    ])
    const { default: handler } = await import(
      '../../../server/api/buildings/[id]/invoice-profile/index.put'
    )

    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
