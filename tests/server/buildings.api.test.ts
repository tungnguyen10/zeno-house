import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Building } from '../../app/types/buildings'

// Hoisted mocks for the service so we can swap behavior per-test
const repoMocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findByIdentifier: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  countRoomsForBuilding: vi.fn(),
  countActiveContractsForBuilding: vi.fn(),
  softArchive: vi.fn(),
}))

vi.mock('../../server/repositories/buildings', () => ({
  BuildingRepository: repoMocks,
}))

const requireAuthMock = vi.hoisted(() => vi.fn())

vi.mock('../../server/utils/auth', () => ({
  requireAuth: requireAuthMock,
}))

vi.stubGlobal('requireAuth', requireAuthMock)

// Stub H3 helpers as identity / passthroughs.
type EventContext = {
  query?: Record<string, unknown>
  body?: unknown
  params?: Record<string, string>
  statusCode?: number
}
type MockEvent = { context: EventContext }

function makeEvent(opts: { query?: Record<string, unknown>; body?: unknown; params?: Record<string, string> } = {}): MockEvent {
  return { context: { query: opts.query, body: opts.body, params: opts.params } }
}

vi.stubGlobal('defineEventHandler', (fn: (event: MockEvent) => unknown) => fn)
vi.stubGlobal('getQuery', (event: MockEvent) => event.context.query ?? {})
vi.stubGlobal('getRouterParam', (event: MockEvent, key: string) => event.context.params?.[key])
vi.stubGlobal('readBody', async (event: MockEvent) => event.context.body)
vi.stubGlobal('setResponseStatus', (event: MockEvent, code: number) => {
  event.context.statusCode = code
})

// Override the default permissive `can` from setup with real role-based checks
// for the buildings.* capabilities. Tests can swap user role via requireAuthMock.
const CAPS: Record<string, Set<string>> = {
  admin: new Set(['buildings.read', 'buildings.create', 'buildings.update', 'buildings.delete']),
  manager: new Set(['buildings.read']),
}
vi.stubGlobal('can', (user: { app_metadata?: { role?: string } }, capability: string) => {
  const role = user?.app_metadata?.role ?? 'admin'
  return CAPS[role]?.has(capability) ?? false
})

function buildBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: overrides.id ?? 'b-1',
    slug: overrides.slug ?? 'toa-a',
    code: overrides.code ?? 'a',
    name: overrides.name ?? 'Toa A',
    address: overrides.address ?? '123 Đường ABC',
    description: overrides.description ?? null,
    status: overrides.status ?? 'active',
    totalRooms: overrides.totalRooms ?? 0,
    serviceSummary: overrides.serviceSummary ?? { totalCount: 0, activeCount: 0, activeNames: [] },
    ownerName: overrides.ownerName ?? null,
    ownerPhone: overrides.ownerPhone ?? null,
    ownerEmail: overrides.ownerEmail ?? null,
    electricityPricingType: overrides.electricityPricingType ?? 'per_kwh',
    defaultElectricityRate: overrides.defaultElectricityRate ?? null,
    waterPricingType: overrides.waterPricingType ?? 'per_m3',
    defaultWaterRate: overrides.defaultWaterRate ?? null,
    meterReadingDay: overrides.meterReadingDay ?? null,
    billingGenerationDay: overrides.billingGenerationDay ?? null,
    paymentDueDay: overrides.paymentDueDay ?? null,
    gracePeriodDays: overrides.gracePeriodDays ?? 0,
    createdAt: overrides.createdAt ?? '2026-06-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-01T00:00:00.000Z',
  }
}

function asAdmin() {
  requireAuthMock.mockResolvedValue({
    id: 'user-admin',
    sub: 'user-admin',
    app_metadata: { role: 'admin' },
  })
}

function asManager() {
  requireAuthMock.mockResolvedValue({
    id: 'user-manager',
    sub: 'user-manager',
    app_metadata: { role: 'manager' },
  })
}

interface ApiError {
  statusCode?: number
  data?: { error?: { code?: string; details?: unknown; message?: string } }
}

async function expectError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
    throw new Error('Expected promise to reject')
  }
  catch (e) {
    return e as ApiError
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/buildings
// ---------------------------------------------------------------------------

describe('GET /api/buildings', () => {
  it('returns pagination envelope with defaults when no query', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [buildBuilding()], total: 1 })
    const { default: handler } = await import('../../server/api/buildings/index.get')

    const res = await handler(makeEvent({ query: {} })) as {
      data: Building[]
      meta: { total: number; page: number; limit: number; totalPages: number }
    }

    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      page: 1,
      limit: 20,
      sort: 'created_at',
      order: 'desc',
    }))
    expect(res.data).toHaveLength(1)
    expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 })
  })

  it('forwards search query to repository', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/buildings/index.get')

    await handler(makeEvent({ query: { q: 'sunrise' } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ q: 'sunrise' }))
  })

  it('normalizes single status to array', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/buildings/index.get')

    await handler(makeEvent({ query: { status: 'active' } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: ['active'] }))
  })

  it('accepts multiple statuses', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/buildings/index.get')

    await handler(makeEvent({ query: { status: ['active', 'inactive'] } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: ['active', 'inactive'] }))
  })

  it('forwards sort by name and total_rooms', async () => {
    asAdmin()
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/buildings/index.get')

    await handler(makeEvent({ query: { sort: 'name', order: 'asc' } }))
    expect(repoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sort: 'name', order: 'asc' }))

    await handler(makeEvent({ query: { sort: 'total_rooms', order: 'desc' } }))
    expect(repoMocks.findAll).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ sort: 'total_rooms', order: 'desc' }))
  })

  it('rejects an invalid sort field with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/buildings/index.get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ query: { sort: 'secret' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// POST /api/buildings
// ---------------------------------------------------------------------------

describe('POST /api/buildings', () => {
  it('creates a building and returns 201 envelope', async () => {
    asAdmin()
    const building = buildBuilding({ id: 'new-1' })
    repoMocks.insert.mockResolvedValue(building)
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const event = makeEvent({ body: { name: 'Toa moi', address: '99 Le Loi' } })
    const res = await handler(event) as { data: Building }

    expect(res.data.id).toBe('new-1')
    expect((event as MockEvent).context.statusCode).toBe(201)
  })

  it('rejects invalid payload with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { name: 'a' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })

  it('forbids managers from creating', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { name: 'Toa moi', address: '99 Le Loi' } }))))
    expect(err.statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /api/buildings/[id]
// ---------------------------------------------------------------------------

describe('GET /api/buildings/[id]', () => {
  it('returns building by id', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildBuilding({ id: 'b-9' }))
    const { default: handler } = await import('../../server/api/buildings/[id].get')

    const res = await handler(makeEvent({ params: { id: 'b-9' } })) as { data: Building }
    expect(res.data.id).toBe('b-9')
    expect(repoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'b-9')
  })

  it('returns building by slug', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildBuilding({ slug: 'toa-a' }))
    const { default: handler } = await import('../../server/api/buildings/[id].get')

    await handler(makeEvent({ params: { id: 'toa-a' } }))
    expect(repoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
  })

  it('returns 404 when not found', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(null)
    const { default: handler } = await import('../../server/api/buildings/[id].get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'missing' } }))))
    expect(err.statusCode).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/buildings/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/buildings/[id]', () => {
  it('updates and returns the building', async () => {
    asAdmin()
    const building = buildBuilding({ id: 'b-2', name: 'Đã đổi' })
    repoMocks.findByIdentifier.mockResolvedValue(buildBuilding({ id: 'b-2' }))
    repoMocks.update.mockResolvedValue(building)
    const { default: handler } = await import('../../server/api/buildings/[id].patch')

    const res = await handler(makeEvent({ params: { id: 'b-2' }, body: { name: 'Đã đổi' } })) as { data: Building }
    expect(res.data.name).toBe('Đã đổi')
  })

  it('forbids managers from updating', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/buildings/[id].patch')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'b-1' }, body: { name: 'Toa moi' } }))))
    expect(err.statusCode).toBe(403)
  })

  it('rejects invalid payload with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/buildings/[id].patch')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'b-1' }, body: { name: 'a' } }))))
    expect(err.statusCode).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/buildings/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/buildings/[id]', () => {
  it('returns 204 when building has no blockers', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildBuilding({ id: 'b-1' }))
    repoMocks.countRoomsForBuilding.mockResolvedValue(0)
    repoMocks.countActiveContractsForBuilding.mockResolvedValue(0)
    repoMocks.remove.mockResolvedValue(undefined)
    const { default: handler } = await import('../../server/api/buildings/[id].delete')

    const event = makeEvent({ params: { id: 'b-1' }, query: {} })
    await handler(event)
    expect((event as MockEvent).context.statusCode).toBe(204)
    expect(repoMocks.remove).toHaveBeenCalledWith(expect.anything(), 'b-1')
  })

  it('returns 409 with rooms count when rooms exist', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildBuilding({ id: 'b-2' }))
    repoMocks.countRoomsForBuilding.mockResolvedValue(5)
    repoMocks.countActiveContractsForBuilding.mockResolvedValue(0)
    const { default: handler } = await import('../../server/api/buildings/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'b-2' }, query: {} }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('CONFLICT')
    expect(err.data?.error?.details).toMatchObject({ rooms: 5, activeContracts: 0 })
  })

  it('returns 409 when active contracts exist', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildBuilding({ id: 'b-3' }))
    repoMocks.countRoomsForBuilding.mockResolvedValue(0)
    repoMocks.countActiveContractsForBuilding.mockResolvedValue(3)
    const { default: handler } = await import('../../server/api/buildings/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'b-3' }, query: {} }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.details).toMatchObject({ activeContracts: 3 })
  })

  it('soft-archives and returns 200 with data when force=true', async () => {
    asAdmin()
    const archived = buildBuilding({ id: 'b-4', status: 'inactive' })
    repoMocks.findByIdentifier.mockResolvedValue(buildBuilding({ id: 'b-4' }))
    repoMocks.softArchive.mockResolvedValue(archived)
    const { default: handler } = await import('../../server/api/buildings/[id].delete')

    const event = makeEvent({ params: { id: 'b-4' }, query: { force: 'true' } })
    const res = await handler(event) as { data: Building }
    expect(res.data.status).toBe('inactive')
    expect(repoMocks.softArchive).toHaveBeenCalledWith(expect.anything(), 'b-4')
    expect(repoMocks.countRoomsForBuilding).not.toHaveBeenCalled()
  })

  it('forbids managers from force-deleting', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/buildings/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'b-1' }, query: { force: 'true' } }))))
    expect(err.statusCode).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// POST /api/buildings/bulk
// ---------------------------------------------------------------------------

describe('POST /api/buildings/bulk', () => {
  it('archives multiple buildings successfully', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockImplementation((_e: unknown, id: string) =>
      Promise.resolve(buildBuilding({ id })),
    )
    repoMocks.softArchive.mockImplementation((_e: unknown, id: string) =>
      Promise.resolve(buildBuilding({ id, status: 'inactive' })),
    )
    const { default: handler } = await import('../../server/api/buildings/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'archive', ids: ['a', 'b'] } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual(['a', 'b'])
    expect(res.data.failed).toEqual([])
    expect(repoMocks.softArchive).toHaveBeenCalledTimes(2)
  })

  it('delete action reports mixed results without short-circuiting', async () => {
    asAdmin()
    // 'empty-1' deletable, 'with-rooms' has rooms, 'missing' not found
    repoMocks.findByIdentifier.mockImplementation((_e: unknown, id: string) => {
      if (id === 'missing') return Promise.resolve(null)
      return Promise.resolve(buildBuilding({ id }))
    })
    repoMocks.countRoomsForBuilding.mockImplementation((_e: unknown, id: string) =>
      id === 'with-rooms' ? Promise.resolve(2) : Promise.resolve(0),
    )
    repoMocks.countActiveContractsForBuilding.mockResolvedValue(0)
    repoMocks.remove.mockResolvedValue(undefined)
    const { default: handler } = await import('../../server/api/buildings/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'delete', ids: ['empty-1', 'with-rooms', 'missing'] } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual(['empty-1'])
    expect(res.data.failed).toEqual(expect.arrayContaining([
      { id: 'with-rooms', reason: 'has_rooms' },
      { id: 'missing', reason: 'not_found' },
    ]))
  })

  it('activate flips status to active', async () => {
    asAdmin()
    const inactive = buildBuilding({ id: 'a', status: 'inactive' })
    const active = buildBuilding({ id: 'a', status: 'active' })
    repoMocks.findByIdentifier.mockResolvedValue(inactive)
    repoMocks.update.mockResolvedValue(active)
    const { default: handler } = await import('../../server/api/buildings/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'activate', ids: ['a'] } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }
    expect(res.data.succeeded).toEqual(['a'])
    expect(repoMocks.update).toHaveBeenCalledWith(expect.anything(), 'a', { status: 'active' })
  })

  it('forbids managers from bulk actions', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/buildings/bulk.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'archive', ids: ['a'] } }))))
    expect(err.statusCode).toBe(403)
  })

  it('rejects empty ids with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/buildings/bulk.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'archive', ids: [] } }))))
    expect(err.statusCode).toBe(422)
  })
})
