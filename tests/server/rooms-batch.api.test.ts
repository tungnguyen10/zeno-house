import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const roomRepo = vi.hoisted(() => ({ createBatch: vi.fn() }))
const buildingRepo = vi.hoisted(() => ({ findByIdentifier: vi.fn() }))
const assertBuildingScope = vi.hoisted(() => vi.fn())
const audit = vi.hoisted(() => ({ append: vi.fn(), appendBulk: vi.fn() }))
const g = vi.hoisted(() => ({ requireAuth: vi.fn(), getRouterParam: vi.fn(), readBody: vi.fn() }))

vi.mock('../../server/repositories/rooms', () => ({ RoomRepository: roomRepo }))
vi.mock('../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../server/utils/scope', () => ({ assertBuildingScope, getVisibleBuildingIds: vi.fn() }))
vi.mock('../../server/services/audit', () => ({ AuditService: audit }))
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('requireAuth', g.requireAuth)
vi.stubGlobal('getRouterParam', g.getRouterParam)
vi.stubGlobal('readBody', g.readBody)
vi.stubGlobal('setResponseStatus', () => {})
vi.stubGlobal('throwValidationError', (message: string, details?: unknown) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message, details } } }
})

const REQ = '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'
const body = { request_id: REQ, apply_inventory: true, rooms: [{ room_number: 'P201', floor: 2, monthly_rent: 1, area: null }] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (u: AuthUser, cap: string) => (u.app_metadata?.role === 'owner' ? true : cap === 'rooms.read'))
  g.getRouterParam.mockReturnValue('zeno')
  buildingRepo.findByIdentifier.mockResolvedValue({ id: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
})

describe('POST /api/buildings/[id]/rooms/batch', () => {
  it('creates rooms with inventory and audits bulk', async () => {
    g.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
    g.readBody.mockResolvedValue(body)
    roomRepo.createBatch.mockResolvedValue({ rooms: [{ id: 'r-1', roomNumber: 'P201' }], replayed: false })
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    const res = await h({} as never) as { meta: { room_count: number; replayed: boolean } }
    expect(res.meta).toEqual({ room_count: 1, replayed: false })
    expect(roomRepo.createBatch).toHaveBeenCalledWith(expect.anything(), 'b-1', body.rooms, { applyInventory: true, actorId: 'o-1', requestId: REQ })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'b-1', 'write')
    expect(audit.appendBulk).toHaveBeenCalledTimes(1)
  })

  it('does not audit on replay', async () => {
    g.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
    g.readBody.mockResolvedValue(body)
    roomRepo.createBatch.mockResolvedValue({ rooms: [{ id: 'r-1' }], replayed: true })
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    await h({} as never)
    expect(audit.appendBulk).not.toHaveBeenCalled()
  })

  it('forbids managers', async () => {
    g.requireAuth.mockResolvedValue({ id: 'm-1', app_metadata: { role: 'manager' } })
    g.readBody.mockResolvedValue(body)
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('requires request_id', async () => {
    g.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
    g.readBody.mockResolvedValue({ ...body, request_id: undefined })
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 422 })
  })
})
