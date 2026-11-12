import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(), getRouterParam: vi.fn(), readBody: vi.fn(),
  get: vi.fn(), save: vi.fn(), readiness: vi.fn(),
}))

vi.mock('../../../server/services/buildings/contract-profile', () => ({
  BuildingContractProfileService: { get: mocks.get, save: mocks.save, readiness: mocks.readiness },
}))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('getRouterParam', mocks.getRouterParam)
vi.stubGlobal('readBody', mocks.readBody)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
  mocks.getRouterParam.mockReturnValue('zeno')
})

describe('contract profile API', () => {
  it('GET wraps the nullable profile', async () => {
    mocks.get.mockResolvedValue(null)
    const { default: handler } = await import('../../../server/api/buildings/[id]/contract-profile/index.get')
    await expect(handler({} as never)).resolves.toEqual({ data: null })
    expect(mocks.get).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'zeno')
  })

  it('PUT validates and forwards parsed input', async () => {
    mocks.readBody.mockResolvedValue({ lessor_full_name: 'Nguyễn Văn A', lessor_phone: '0901 234 567' })
    mocks.save.mockResolvedValue({ buildingId: 'b-1' })
    const { default: handler } = await import('../../../server/api/buildings/[id]/contract-profile/index.put')
    await handler({ context: {} } as never)
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'zeno',
      expect.objectContaining({ lessor_full_name: 'Nguyễn Văn A', lessor_phone: '0901234567', signed_copies: 2 }))
  })

  it('PUT rejects invalid id number with 422 and without echo', async () => {
    mocks.readBody.mockResolvedValue({ lessor_id_number: '12AB' })
    const { default: handler } = await import('../../../server/api/buildings/[id]/contract-profile/index.put')
    try {
      await handler({ context: {} } as never)
      throw new Error('expected 422')
    }
    catch (e) {
      expect(e).toMatchObject({ statusCode: 422 })
      expect(JSON.stringify(e)).not.toContain('12AB')
    }
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('GET readiness wraps the result', async () => {
    mocks.readiness.mockResolvedValue({ contract: { ready: false, missing: ['invoice_profile'] }, billing: { ready: true, missing: [] } })
    const { default: handler } = await import('../../../server/api/buildings/[id]/readiness.get')
    await expect(handler({} as never)).resolves.toMatchObject({ data: { contract: { ready: false } } })
  })
})
