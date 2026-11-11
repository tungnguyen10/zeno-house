import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { Building } from '~/types/buildings'
import type { AuthUser } from '~/types/auth'

const buildingRepo = vi.hoisted(() => ({
  createWithRooms: vi.fn(),
  insert: vi.fn(),
  findByIdentifier: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  removeWithAudit: vi.fn(),
  softArchive: vi.fn(),
  countRoomsForBuilding: vi.fn(),
  countActiveContractsForBuilding: vi.fn(),
}))

const assignmentRepo = vi.hoisted(() => ({
  insert: vi.fn(),
  findBuildingIdsByUser: vi.fn(),
}))

const auditService = vi.hoisted(() => ({ append: vi.fn(), appendBulk: vi.fn() }))
const bulkRepo = vi.hoisted(() => ({ resolveSnapshots: vi.fn() }))

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../../server/repositories/assignments', () => ({ AssignmentRepository: assignmentRepo }))
vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))
vi.mock('../../../server/repositories/bulk-actions', () => ({ BulkActionRepository: bulkRepo }))

function user(role: 'admin' | 'owner' | 'manager', id = `${role}-1`): AuthUser {
  return { id, app_metadata: { role } } as AuthUser
}

function event() {
  return { context: {} } as never
}

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: overrides.id ?? 'b-1',
    slug: 'toa-a',
    code: 'a',
    name: 'Tòa A',
    address: '123',
    description: null,
    status: 'active',
    totalRooms: 0,
    serviceSummary: { totalCount: 0, activeCount: 0, activeNames: [] },
    ownerName: null,
    ownerPhone: null,
    ownerEmail: null,
    electricityPricingType: 'per_kwh',
    defaultElectricityRate: null,
    waterPricingType: 'per_m3',
    defaultWaterRate: null,
    meterReadingDay: null,
    billingGenerationDay: null,
    paymentDueDay: null,
    gracePeriodDays: 0,
    createdBy: null,
    ownerUserId: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('BuildingService.create (atomic)', () => {
  const room = (id: string, n: string) => ({ id, roomNumber: n, buildingId: 'new-1' })

  beforeEach(() => {
    vi.clearAllMocks()
    bulkRepo.resolveSnapshots.mockResolvedValue(new Map())
  })

  it('passes owner as assignee and audits building, assignment and rooms', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({
      building: building({ id: 'new-1' }), rooms: [room('r-1', 'P101'), room('r-2', 'P102')], replayed: false,
    })
    const { BuildingService } = await import('../../../server/services/buildings')

    const res = await BuildingService.create(event(), user('owner'), {
      name: 'X', address: 'Y', request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f',
      rooms: [{ room_number: 'P101', floor: 1, monthly_rent: 1, area: null }, { room_number: 'P102', floor: 1, monthly_rent: 1, area: null }],
    } as never)

    expect(res.roomCount).toBe(2)
    expect(buildingRepo.createWithRooms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'X' }),
      expect.arrayContaining([expect.objectContaining({ room_number: 'P101' })]),
      { actorId: 'owner-1', ownerUserId: 'owner-1', requestId: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f' },
    )
    expect(buildingRepo.createWithRooms.mock.calls[0]![1]).not.toHaveProperty('rooms')
    expect(buildingRepo.createWithRooms.mock.calls[0]![1]).not.toHaveProperty('request_id')
    expect(assignmentRepo.insert).not.toHaveBeenCalled()
    const actions = auditService.append.mock.calls.map(c => c[2].action)
    expect(actions).toEqual(['user.assignment_added', 'building.created'])
    expect(auditService.append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'building.created', metadata: { room_count: 2, request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f' },
    }))
    expect(auditService.appendBulk).toHaveBeenCalledTimes(1)
    expect(auditService.appendBulk.mock.calls[0]![2]).toMatchObject({
      building_id: 'new-1', entity_type: 'room', aggregate_action: 'room.bulk_create',
      succeeded: ['r-1', 'r-2'], total: 2, failed: 0,
      items: [
        { entity_id: 'r-1', action: 'room.created', after_data: room('r-1', 'P101') },
        { entity_id: 'r-2', action: 'room.created', after_data: room('r-2', 'P102') },
      ],
    })
  })

  it('does not assign admins and generates a request id when absent', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({ building: building({ id: 'new-2' }), rooms: [], replayed: false })
    const { BuildingService } = await import('../../../server/services/buildings')

    await BuildingService.create(event(), user('admin'), { name: 'X', address: 'Y' } as never)

    const opts = buildingRepo.createWithRooms.mock.calls[0]![3]
    expect(opts.ownerUserId).toBeNull()
    expect(opts.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(auditService.appendBulk).not.toHaveBeenCalled()
    expect(auditService.append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'building.created', metadata: { room_count: 0, request_id: opts.requestId },
    }))
  })

  it('skips all audit on replay', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({ building: building({ id: 'new-3' }), rooms: [room('r-1', 'P101')], replayed: true })
    const { BuildingService } = await import('../../../server/services/buildings')

    const res = await BuildingService.create(event(), user('owner'), { name: 'X', address: 'Y', rooms: [] } as never)

    expect(res.building.id).toBe('new-3')
    expect(res.roomCount).toBe(1)
    expect(auditService.append).not.toHaveBeenCalled()
    expect(auditService.appendBulk).not.toHaveBeenCalled()
  })

  it('resets the per-request building scope cache', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({ building: building({ id: 'new-4' }), rooms: [], replayed: false })
    const { BuildingService } = await import('../../../server/services/buildings')
    const ev = { context: { __buildingScope: ['old'] } } as never

    await BuildingService.create(ev, user('owner'), { name: 'X', address: 'Y' } as never)
    expect((ev as { context: Record<string, unknown> }).context.__buildingScope).toBeUndefined()
  })
})

describe('BuildingService owner scoped mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignmentRepo.findBuildingIdsByUser.mockResolvedValue(['b-1'])
    bulkRepo.resolveSnapshots.mockResolvedValue(new Map())
  })

  it('allows owner to update a building inside scope', async () => {
    buildingRepo.findByIdentifier.mockResolvedValue(building({ id: 'b-1' }))
    buildingRepo.update.mockResolvedValue(building({ id: 'b-1', name: 'New' }))
    const { BuildingService } = await import('../../../server/services/buildings')

    await BuildingService.update(event(), user('owner'), 'b-1', { name: 'New' } as never)
    expect(buildingRepo.update).toHaveBeenCalled()
  })

  it('forbids owner update outside scope with 403', async () => {
    buildingRepo.findByIdentifier.mockResolvedValue(building({ id: 'b-2' }))
    const { BuildingService } = await import('../../../server/services/buildings')

    await expect(
      BuildingService.update(event(), user('owner'), 'b-2', { name: 'New' } as never),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(buildingRepo.update).not.toHaveBeenCalled()
  })

  it('deletes an empty building inside owner scope', async () => {
    buildingRepo.findByIdentifier.mockResolvedValue(building({ id: 'b-1' }))
    buildingRepo.countRoomsForBuilding.mockResolvedValue(0)
    buildingRepo.countActiveContractsForBuilding.mockResolvedValue(0)
    buildingRepo.remove.mockResolvedValue(undefined)
    const { BuildingService } = await import('../../../server/services/buildings')

    await BuildingService.remove(event(), user('owner'), 'b-1')
    expect(buildingRepo.removeWithAudit).toHaveBeenCalledWith(expect.anything(), 'b-1', 'owner-1', expect.any(String))
  })

  it('keeps conflict checks for owner delete of a building with blockers', async () => {
    buildingRepo.findByIdentifier.mockResolvedValue(building({ id: 'b-1' }))
    buildingRepo.countRoomsForBuilding.mockResolvedValue(3)
    buildingRepo.countActiveContractsForBuilding.mockResolvedValue(0)
    const { BuildingService } = await import('../../../server/services/buildings')

    await expect(BuildingService.remove(event(), user('owner'), 'b-1'))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(buildingRepo.remove).not.toHaveBeenCalled()
  })

  it('forbids owner delete outside scope with 403', async () => {
    buildingRepo.findByIdentifier.mockResolvedValue(building({ id: 'b-2' }))
    const { BuildingService } = await import('../../../server/services/buildings')

    await expect(BuildingService.remove(event(), user('owner'), 'b-2'))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('does not bulk archive buildings outside owner scope', async () => {
    buildingRepo.findByIdentifier.mockResolvedValue(building({ id: 'b-2' }))
    const { BuildingService } = await import('../../../server/services/buildings')

    const result = await BuildingService.bulkAction(event(), user('owner'), {
      action: 'archive',
      ids: ['b-2'],
    } as never)

    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([{ id: 'b-2', reason: 'Không có quyền thao tác với tòa nhà này' }])
    expect(buildingRepo.softArchive).not.toHaveBeenCalled()
  })

  it('does not bulk activate buildings outside owner scope', async () => {
    buildingRepo.findByIdentifier.mockResolvedValue(building({ id: 'b-2' }))
    const { BuildingService } = await import('../../../server/services/buildings')

    const result = await BuildingService.bulkAction(event(), user('owner'), {
      action: 'activate',
      ids: ['b-2'],
    } as never)

    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([{ id: 'b-2', reason: 'Không có quyền thao tác với tòa nhà này' }])
    expect(buildingRepo.update).not.toHaveBeenCalled()
  })
})
