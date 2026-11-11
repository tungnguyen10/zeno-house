import { beforeEach, describe, expect, it, vi } from 'vitest'
import { can } from '../../../server/utils/permissions'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(), getRouterParam: vi.fn(), readBody: vi.fn(),
  findBuilding: vi.fn(), findProfile: vi.fn(), upsert: vi.fn(), findInvoice: vi.fn(), scope: vi.fn(), audit: vi.fn(),
}))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: mocks.findBuilding } }))
vi.mock('../../../server/repositories/building-contract-profiles', () => ({
  BuildingContractProfileRepository: { findByBuildingId: mocks.findProfile, upsert: mocks.upsert },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({ BuildingInvoiceProfileRepository: { findByBuildingId: mocks.findInvoice } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.scope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: mocks.audit } }))

const rawId = '012345678901'
const row = {
  building_id: 'b-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi, Huế', lessor_id_number: rawId, lessor_id_issued_date: '2021-05-01',
  lessor_id_issued_place: 'Huế', lessor_phone: '0901234567', brand_name: null, default_term_months: 12,
  default_deposit_months: 1, notice_days: 30, deposit_refund_days: 7, renewal_months: 0, extra_occupant_fee: 0,
  drilling_fee: 0, fingerprint_reset_fee: 0, signed_copies: 2, copies_per_party: 1, updated_by: 'o-1',
  created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}
const event = { context: {} } as never
const routes = {
  get: () => import('../../../server/api/buildings/[id]/contract-profile/index.get'),
  put: () => import('../../../server/api/buildings/[id]/contract-profile/index.put'),
  readiness: () => import('../../../server/api/buildings/[id]/readiness.get'),
}
const authenticate = (role: string) => mocks.requireAuth.mockResolvedValue({ id: 'u-1', app_metadata: { role } })

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireAuth', mocks.requireAuth)
  vi.stubGlobal('getRouterParam', mocks.getRouterParam)
  vi.stubGlobal('readBody', mocks.readBody)
  vi.stubGlobal('can', can)
  authenticate('owner')
  mocks.getRouterParam.mockReturnValue('zeno')
  mocks.readBody.mockResolvedValue({ lessor_full_name: 'Nguyễn Văn A' })
  mocks.findBuilding.mockResolvedValue({
    id: 'b-1', billingGenerationDay: 1, paymentDueDay: 5, electricityPricingType: 'per_kwh',
    defaultElectricityRate: 3500, waterPricingType: 'per_m3', defaultWaterRate: 15000,
  })
  mocks.findProfile.mockResolvedValue(row)
  mocks.findInvoice.mockResolvedValue({ building_id: 'b-1' })
  mocks.upsert.mockImplementation(async (_event, _id, input) => ({ ...row, ...input }))
})

describe('building contract profile API', () => {
  it.each(['admin', 'owner'])('GET returns full profile for %s', async (role) => {
    authenticate(role)
    const { default: handler } = await routes.get()
    await expect(handler(event)).resolves.toMatchObject({ data: {
      lessorIdNumber: rawId, lessorDateOfBirth: row.lessor_date_of_birth,
      lessorPermanentAddress: row.lessor_permanent_address, lessorIdentityMasked: false,
    } })
    expect(mocks.findBuilding).toHaveBeenCalledWith(event, 'zeno')
  })

  it('GET returns null when the building has no profile', async () => {
    mocks.findProfile.mockResolvedValue(null)
    const { default: handler } = await routes.get()
    await expect(handler(event)).resolves.toEqual({ data: null })
  })

  it('GET masks all private identity fields for manager', async () => {
    authenticate('manager')
    const { default: handler } = await routes.get()
    const response = await handler(event)
    expect(response.data).toMatchObject({ lessorIdNumber: '*******8901', lessorIdentityMasked: true })
    for (const value of [rawId, row.lessor_date_of_birth, row.lessor_permanent_address]) {
      expect(JSON.stringify(response)).not.toContain(value)
    }
  })

  it.each(['admin', 'owner'])('PUT accepts a partial profile for %s and applies defaults', async (role) => {
    authenticate(role)
    mocks.readBody.mockResolvedValue({ lessor_full_name: ' Nguyễn Văn A ', lessor_phone: '0901 234 567' })
    const { default: handler } = await routes.put()
    await expect(handler(event)).resolves.toMatchObject({ data: { lessorFullName: 'Nguyễn Văn A', lessorIdNumber: null } })
    expect(mocks.upsert).toHaveBeenCalledWith(event, 'b-1', expect.objectContaining({
      lessor_full_name: 'Nguyễn Văn A', lessor_phone: '0901234567', lessor_id_number: null, signed_copies: 2,
    }), 'u-1')
  })

  it('PUT rejects manager before accessing profile data', async () => {
    authenticate('manager')
    const { default: handler } = await routes.put()
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.findProfile).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it.each([
    { lessor_id_number: '12AB-private' },
    { lessor_date_of_birth: 'private-date' },
    { lessor_permanent_address: 'private-address'.repeat(30) },
    { lessor_id_number: { secret: rawId } },
  ])('PUT returns static 422 details without echoing invalid identity input %#', async (body) => {
    mocks.readBody.mockResolvedValue(body)
    const { default: handler } = await routes.put()
    const error = await handler(event).catch((error: unknown) => error)
    expect(error).toMatchObject({ statusCode: 422, data: { error: {
      code: 'VALIDATION_ERROR', message: 'Thông tin hợp đồng không hợp lệ',
      details: { fieldErrors: expect.any(Object), formErrors: [] },
    } } })
    for (const value of [rawId, 'private', JSON.stringify(body)]) expect(JSON.stringify(error)).not.toContain(value)
    expect(mocks.findProfile).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('readiness returns derived status without private values for manager', async () => {
    authenticate('manager')
    const { default: handler } = await routes.readiness()
    const response = await handler(event)
    expect(response).toEqual({ data: { contract: { ready: true, missing: [] }, billing: { ready: true, missing: [] } } })
    for (const value of [rawId, row.lessor_date_of_birth, row.lessor_permanent_address]) expect(JSON.stringify(response)).not.toContain(value)
  })

  it.each(['get', 'put', 'readiness'] as const)('%s preserves outside-scope read404/write403 without sensitive access', async (route) => {
    const statusCode = route === 'put' ? 403 : 404
    mocks.scope.mockRejectedValue(Object.assign(new Error('Outside scope'), { statusCode }))
    const { default: handler } = await routes[route]()
    await expect(handler(event)).rejects.toMatchObject({ statusCode })
    expect(mocks.findProfile).not.toHaveBeenCalled()
    expect(mocks.findInvoice).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it.each(['get', 'put', 'readiness'] as const)('%s rejects unauthenticated callers before reading request or data', async (route) => {
    mocks.requireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))
    const { default: handler } = await routes[route]()
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.getRouterParam).not.toHaveBeenCalled()
    expect(mocks.readBody).not.toHaveBeenCalled()
    expect(mocks.findBuilding).not.toHaveBeenCalled()
  })

  it.each(['get', 'put', 'readiness'] as const)('%s rejects missing identifiers before repository access', async (route) => {
    mocks.getRouterParam.mockReturnValue(undefined)
    const { default: handler } = await routes[route]()
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.findBuilding).not.toHaveBeenCalled()
    expect(mocks.readBody).not.toHaveBeenCalled()
  })

  it.each(['get', 'put', 'readiness'] as const)('%s returns 404 for unknown building identifiers', async (route) => {
    mocks.findBuilding.mockResolvedValue(null)
    const { default: handler } = await routes[route]()
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.findProfile).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
