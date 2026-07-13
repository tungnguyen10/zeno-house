import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Room } from '../../app/types/rooms'

const roomRepoMocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findByIdentifier: vi.fn(),
  findByBuildingAndRoomSlug: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  countActiveContractsForRoom: vi.fn(),
  countMeterReadingsForRoom: vi.fn(),
  softArchive: vi.fn(),
}))

const buildingRepoMocks = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
}))

const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
  findByUserAndBuilding: vi.fn(),
}))
const bulkRepoMocks = vi.hoisted(() => ({ resolveBuildingScopes: vi.fn(), execute: vi.fn() }))

vi.mock('../../server/repositories/rooms', () => ({
  RoomRepository: roomRepoMocks,
}))

vi.mock('../../server/repositories/buildings', () => ({
  BuildingRepository: buildingRepoMocks,
}))

vi.mock('../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))
vi.mock('../../server/repositories/bulk-actions', () => ({ BulkActionRepository: bulkRepoMocks }))

const requireAuthMock = vi.hoisted(() => vi.fn())

vi.mock('../../server/utils/auth', () => ({
  requireAuth: requireAuthMock,
}))

vi.stubGlobal('requireAuth', requireAuthMock)

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

const CAPS: Record<string, Set<string>> = {
  admin: new Set(['rooms.read', 'rooms.create', 'rooms.update', 'rooms.delete']),
  manager: new Set(['rooms.read']),
}
vi.stubGlobal('can', (user: { app_metadata?: { role?: string } }, capability: string) => {
  const role = user?.app_metadata?.role ?? 'admin'
  return CAPS[role]?.has(capability) ?? false
})

function buildRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: overrides.id ?? 'r-1',
    buildingId: overrides.buildingId ?? 'b-1',
    roomNumber: overrides.roomNumber ?? '101',
    slug: overrides.slug ?? '101',
    code: overrides.code ?? 'a-101',
    floor: overrides.floor ?? 1,
    status: overrides.status ?? 'available',
    monthlyRent: overrides.monthlyRent ?? 3000000,
    area: overrides.area ?? null,
    description: overrides.description ?? null,
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
  buildingRepoMocks.findByIdentifier.mockResolvedValue({ id: 'b-1' })
  assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['b-1'])
  assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue(null)
  bulkRepoMocks.resolveBuildingScopes.mockImplementation((_event, _entity, ids: string[]) =>
    Promise.resolve(new Map(ids.map(id => [id, 'b-1']))),
  )
  bulkRepoMocks.execute.mockImplementation((_event, _entity, _action, ids: string[]) =>
    Promise.resolve(ids.map(id => ({ id, succeeded: true, reason: null }))),
  )
})

describe('GET /api/rooms', () => {
  it('returns pagination envelope with defaults', async () => {
    asAdmin()
    roomRepoMocks.findAll.mockResolvedValue({ items: [buildRoom()], total: 1 })
    const { default: handler } = await import('../../server/api/rooms/index.get')

    const res = await handler(makeEvent({ query: {} })) as {
      data: Room[]
      meta: { total: number; page: number; limit: number; totalPages: number }
    }

    expect(roomRepoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      page: 1,
      limit: 20,
      sort: 'floor',
      order: 'asc',
    }))
    expect(res.data).toHaveLength(1)
    expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 })
  })

  it('forwards search, building, floor, multi-status, and sort filters', async () => {
    asAdmin()
    roomRepoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/rooms/index.get')

    await handler(makeEvent({
      query: {
        q: 'a10',
        building_id: 'toa-a',
        floor: '2',
        status: ['available', 'occupied'],
        sort: 'monthly_rent',
        order: 'desc',
      },
    }))

    expect(buildingRepoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(roomRepoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingId: 'b-1',
      q: 'a10',
      floor: 2,
      status: ['available', 'occupied'],
      sort: 'monthly_rent',
      order: 'desc',
    }))
  })

  it('normalizes single status to array and accepts archived', async () => {
    asAdmin()
    roomRepoMocks.findAll.mockResolvedValue({ items: [], total: 0 })
    const { default: handler } = await import('../../server/api/rooms/index.get')

    await handler(makeEvent({ query: { status: 'archived' } }))
    expect(roomRepoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: ['archived'] }))
  })

  it('rejects invalid sort with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/rooms/index.get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ query: { sort: 'secret' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })

  it('passes manager assigned building ids into room list filters', async () => {
    asManager()
    roomRepoMocks.findAll.mockResolvedValue({ items: [buildRoom({ buildingId: 'b-1' })], total: 1 })
    const { default: handler } = await import('../../server/api/rooms/index.get')

    await handler(makeEvent({ query: {} }))
    expect(roomRepoMocks.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingIds: ['b-1'],
    }))
  })
})

describe('POST /api/rooms', () => {
  it('creates a room and returns 201 envelope', async () => {
    asAdmin()
    roomRepoMocks.insert.mockResolvedValue(buildRoom({ id: 'new-1' }))
    const { default: handler } = await import('../../server/api/rooms/index.post')

    const event = makeEvent({
      body: { building_id: '0f63f970-2f65-4a5d-9e24-1c4aa58d5e4b', room_number: '101', floor: 1, monthly_rent: 3000000 },
    })
    const res = await handler(event) as { data: Room }

    expect(res.data.id).toBe('new-1')
    expect(event.context.statusCode).toBe(201)
  })

  it('rejects validation error and manager create', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/rooms/index.post')
    const invalid = await expectError(Promise.resolve(handler(makeEvent({ body: { room_number: '' } }))))
    expect(invalid.statusCode).toBe(422)

    asManager()
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({
      body: { building_id: '0f63f970-2f65-4a5d-9e24-1c4aa58d5e4b', room_number: '101', floor: 1, monthly_rent: 3000000 },
    }))))
    expect(forbidden.statusCode).toBe(403)
  })
})

describe('GET room detail endpoints', () => {
  it('returns room by id/code', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ code: 'a-101' }))
    const { default: handler } = await import('../../server/api/rooms/[id].get')

    const res = await handler(makeEvent({ params: { id: 'a-101' } })) as { data: Room }
    expect(res.data.code).toBe('a-101')
    expect(roomRepoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'a-101')
  })

  it('returns nested building+room slug detail', async () => {
    asAdmin()
    roomRepoMocks.findByBuildingAndRoomSlug.mockResolvedValue(buildRoom({ slug: '101' }))
    const { default: handler } = await import('../../server/api/buildings/[id]/rooms/[room].get')

    await handler(makeEvent({ params: { id: 'toa-a', room: '101' } }))
    expect(buildingRepoMocks.findByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(roomRepoMocks.findByBuildingAndRoomSlug).toHaveBeenCalledWith(expect.anything(), 'b-1', '101')
  })

  it('returns 404 when not found', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockResolvedValue(null)
    const { default: handler } = await import('../../server/api/rooms/[id].get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'missing' } }))))
    expect(err.statusCode).toBe(404)
  })

  it('returns 404 when manager reads a room outside scope', async () => {
    asManager()
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['b-1'])
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-2', buildingId: 'b-2' }))
    const { default: handler } = await import('../../server/api/rooms/[id].get')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'r-2' } }))))
    expect(err.statusCode).toBe(404)
  })
})

describe('PATCH /api/rooms/[id]', () => {
  it('updates a room', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-1' }))
    roomRepoMocks.update.mockResolvedValue(buildRoom({ roomNumber: '102' }))
    const { default: handler } = await import('../../server/api/rooms/[id].patch')

    const res = await handler(makeEvent({ params: { id: 'r-1' }, body: { room_number: '102' } })) as { data: Room }
    expect(res.data.roomNumber).toBe('102')
  })

  it('forbids managers and rejects invalid payload', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/rooms/[id].patch')
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'r-1' }, body: { room_number: '102' } }))))
    expect(forbidden.statusCode).toBe(403)

    asAdmin()
    const invalid = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'r-1' }, body: { floor: 0 } }))))
    expect(invalid.statusCode).toBe(422)
  })

  it('returns 403 when manager mutates a room outside scope', async () => {
    CAPS.manager.add('rooms.update')
    try {
      asManager()
      assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['b-1'])
      roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-2', buildingId: 'b-2' }))
      const { default: handler } = await import('../../server/api/rooms/[id].patch')

      const err = await expectError(Promise.resolve(handler(makeEvent({
        params: { id: 'r-2' },
        body: { room_number: '202' },
      }))))
      expect(err.statusCode).toBe(403)
    }
    finally {
      CAPS.manager.delete('rooms.update')
    }
  })
})

describe('DELETE /api/rooms/[id]', () => {
  it('hard deletes empty room with 204', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-1' }))
    roomRepoMocks.countActiveContractsForRoom.mockResolvedValue(0)
    roomRepoMocks.countMeterReadingsForRoom.mockResolvedValue(0)
    const { default: handler } = await import('../../server/api/rooms/[id].delete')

    const event = makeEvent({ params: { id: 'r-1' }, body: { reason: 'cleanup' } })
    await handler(event)
    expect(roomRepoMocks.remove).toHaveBeenCalledWith(expect.anything(), 'r-1')
    expect(event.context.statusCode).toBe(204)
  })

  it('returns 409 when active contracts or meter readings exist', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-1' }))
    roomRepoMocks.countActiveContractsForRoom.mockResolvedValue(1)
    roomRepoMocks.countMeterReadingsForRoom.mockResolvedValue(5)
    const { default: handler } = await import('../../server/api/rooms/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'r-1' }, body: { reason: 'cleanup' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.details).toEqual({ activeContracts: 1, meterReadings: 5 })
  })

  it('force=true soft-archives and managers cannot force', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-1' }))
    roomRepoMocks.softArchive.mockResolvedValue(buildRoom({ id: 'r-1', status: 'archived' }))
    const { default: handler } = await import('../../server/api/rooms/[id].delete')

    const res = await handler(makeEvent({ params: { id: 'r-1' }, query: { force: 'true' }, body: { reason: 'archive' } })) as { data: Room }
    expect(res.data.status).toBe('archived')

    asManager()
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'r-1' }, query: { force: 'true' }, body: { reason: 'archive' } }))))
    expect(forbidden.statusCode).toBe(403)
  })

  it('lets manager hard-delete only when can_delete_master_data is granted for that building', async () => {
    asManager()
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-1', buildingId: 'b-1' }))
    roomRepoMocks.countActiveContractsForRoom.mockResolvedValue(0)
    roomRepoMocks.countMeterReadingsForRoom.mockResolvedValue(0)
    const { default: handler } = await import('../../server/api/rooms/[id].delete')

    assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue(null)
    const denied = await expectError(Promise.resolve(handler(makeEvent({
      params: { id: 'r-1' },
      body: { reason: 'cleanup' },
    }))))
    expect(denied.statusCode).toBe(403)

    assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue({ can_delete_master_data: true })
    const event = makeEvent({ params: { id: 'r-1' }, body: { reason: 'cleanup' } })
    await handler(event)
    expect(roomRepoMocks.remove).toHaveBeenCalledWith(expect.anything(), 'r-1')
    expect(event.context.statusCode).toBe(204)
  })

  it('does not let a destructive flag for one building delete another building', async () => {
    asManager()
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['b-2'])
    assignmentRepoMocks.findByUserAndBuilding.mockResolvedValue(null)
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-2', buildingId: 'b-2' }))
    const { default: handler } = await import('../../server/api/rooms/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({
      params: { id: 'r-2' },
      body: { reason: 'cleanup' },
    }))))
    expect(err.statusCode).toBe(403)
    expect(roomRepoMocks.remove).not.toHaveBeenCalled()
  })

  it('requires a delete reason', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/rooms/[id].delete')

    const err = await expectError(Promise.resolve(handler(makeEvent({ params: { id: 'r-1' }, body: {} }))))
    expect(err.statusCode).toBe(422)
  })
})

describe('POST /api/rooms/bulk', () => {
  it('archives, activates, and sets maintenance', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockResolvedValue(buildRoom({ id: 'r-1' }))
    const { default: handler } = await import('../../server/api/rooms/bulk.post')

    await handler(makeEvent({ body: { action: 'archive', ids: ['r-1'] } }))
    expect(bulkRepoMocks.execute).toHaveBeenCalledWith(expect.anything(), 'room', 'archive', ['r-1'])

    await handler(makeEvent({ body: { action: 'activate', ids: ['r-1'] } }))
    expect(bulkRepoMocks.execute).toHaveBeenCalledWith(expect.anything(), 'room', 'activate', ['r-1'])

    await handler(makeEvent({ body: { action: 'set_maintenance', ids: ['r-1'] } }))
    expect(bulkRepoMocks.execute).toHaveBeenCalledWith(expect.anything(), 'room', 'set_maintenance', ['r-1'])
  })

  it('returns mixed result reasons for delete', async () => {
    asAdmin()
    roomRepoMocks.findByIdentifier.mockImplementation(async (_event, id: string) => {
      if (id === 'missing') return null
      return buildRoom({ id })
    })
    roomRepoMocks.countActiveContractsForRoom.mockImplementation(async (_event, id: string) => id === 'with-contract' ? 1 : 0)
    roomRepoMocks.countMeterReadingsForRoom.mockResolvedValue(0)
    const { default: handler } = await import('../../server/api/rooms/bulk.post')

    const res = await handler(makeEvent({ body: { action: 'delete', ids: ['empty-1', 'with-contract', 'missing'], reason: 'cleanup' } })) as {
      data: { succeeded: string[]; failed: { id: string; reason: string }[] }
    }

    expect(res.data.succeeded).toEqual(['empty-1'])
    expect(res.data.failed).toEqual([
      { id: 'with-contract', reason: 'has_active_contracts' },
      { id: 'missing', reason: 'not_found' },
    ])
  })

  it('forbids manager and rejects empty ids', async () => {
    const { default: handler } = await import('../../server/api/rooms/bulk.post')

    asManager()
    const forbidden = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'archive', ids: ['r-1'] } }))))
    expect(forbidden.statusCode).toBe(403)

    asAdmin()
    const invalid = await expectError(Promise.resolve(handler(makeEvent({ body: { action: 'archive', ids: [] } }))))
    expect(invalid.statusCode).toBe(422)
  })
})
