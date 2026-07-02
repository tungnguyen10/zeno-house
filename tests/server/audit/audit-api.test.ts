import { describe, expect, it, beforeEach, vi } from 'vitest'
import { can as realCan } from '../../../server/utils/permissions'

vi.stubGlobal('can', realCan)

const requireAuthMock = vi.hoisted(() => vi.fn())
const auditRepo = vi.hoisted(() => ({ listByBuilding: vi.fn(), listAll: vi.fn() }))
const buildingRepo = vi.hoisted(() => ({ findByIdentifier: vi.fn() }))
const scope = vi.hoisted(() => ({ assertBuildingScope: vi.fn() }))
const enrich = vi.hoisted(() => ({ enrichAuditEvents: vi.fn() }))

vi.mock('../../../server/utils/auth', () => ({ requireAuth: requireAuthMock }))
vi.mock('../../../server/repositories/audit', () => ({ AuditRepository: auditRepo }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../../server/utils/scope', () => scope)
vi.mock('../../../server/services/audit-enrichment', () => enrich)

vi.stubGlobal('requireAuth', requireAuthMock)
vi.stubGlobal('defineEventHandler', (fn: (event: unknown) => unknown) => fn)
vi.stubGlobal('getQuery', (event: { context: { query?: unknown } }) => event.context.query ?? {})

function event(query: Record<string, unknown> = {}) {
  return { context: { query } } as never
}

async function expectError(promise: Promise<unknown>): Promise<{ statusCode?: number }> {
  try {
    await promise
    throw new Error('Expected rejection')
  }
  catch (e) {
    return e as { statusCode?: number }
  }
}

describe('GET /api/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditRepo.listAll.mockResolvedValue({ items: [], total: 0 })
    auditRepo.listByBuilding.mockResolvedValue({ items: [], total: 0 })
    buildingRepo.findByIdentifier.mockResolvedValue({ id: 'b-1' })
    scope.assertBuildingScope.mockResolvedValue(undefined)
    enrich.enrichAuditEvents.mockResolvedValue([])
  })

  it('lets admin query globally without a building_id', async () => {
    requireAuthMock.mockResolvedValue({ id: 'a', app_metadata: { role: 'admin' } })
    const { default: handler } = await import('../../../server/api/audit/index.get')
    await handler(event({}))
    expect(auditRepo.listAll).toHaveBeenCalled()
  })

  it('requires owner to provide a building_id (422)', async () => {
    requireAuthMock.mockResolvedValue({ id: 'o', app_metadata: { role: 'owner' } })
    const { default: handler } = await import('../../../server/api/audit/index.get')
    const err = await expectError(Promise.resolve(handler(event({}))))
    expect(err.statusCode).toBe(422)
  })

  it('lets owner query an in-scope building', async () => {
    requireAuthMock.mockResolvedValue({ id: 'o', app_metadata: { role: 'owner' } })
    const { default: handler } = await import('../../../server/api/audit/index.get')
    await handler(event({ building_id: 'b-1' }))
    expect(scope.assertBuildingScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'b-1', 'read')
    expect(auditRepo.listByBuilding).toHaveBeenCalled()
  })

  it('returns 404 for owner querying an out-of-scope building', async () => {
    requireAuthMock.mockResolvedValue({ id: 'o', app_metadata: { role: 'owner' } })
    scope.assertBuildingScope.mockRejectedValue(Object.assign(new Error('Not found'), { statusCode: 404 }))
    const { default: handler } = await import('../../../server/api/audit/index.get')
    const err = await expectError(Promise.resolve(handler(event({ building_id: 'b-9' }))))
    expect(err.statusCode).toBe(404)
  })

  it('uses app_metadata.role, not top-level role, for authorization', async () => {
    // Top-level role says admin, but app_metadata says owner -> treated as owner.
    requireAuthMock.mockResolvedValue({ id: 'x', role: 'admin', app_metadata: { role: 'owner' } })
    const { default: handler } = await import('../../../server/api/audit/index.get')
    const err = await expectError(Promise.resolve(handler(event({}))))
    expect(err.statusCode).toBe(422)
    expect(auditRepo.listAll).not.toHaveBeenCalled()
  })
})
