import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { Building } from '~/types/buildings'
import type { AuthUser } from '~/types/auth'

const buildingRepo = vi.hoisted(() => ({
  insert: vi.fn(),
  findByIdentifier: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  softArchive: vi.fn(),
  countRoomsForBuilding: vi.fn(),
  countActiveContractsForBuilding: vi.fn(),
}))

const assignmentRepo = vi.hoisted(() => ({
  insert: vi.fn(),
  findBuildingIdsByUser: vi.fn(),
}))

const auditService = vi.hoisted(() => ({ append: vi.fn(), appendBulk: vi.fn() }))

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../../server/repositories/assignments', () => ({ AssignmentRepository: assignmentRepo }))
vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))

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
    name: 'Toa A',
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

describe('BuildingService.create ownership workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-assigns owner-created buildings to the owner', async () => {
    buildingRepo.insert.mockResolvedValue(building({ id: 'new-1' }))
    assignmentRepo.insert.mockResolvedValue({ id: 'a-1' })
    const { BuildingService } = await import('../../../server/services/buildings')

    await BuildingService.create(event(), user('owner'), { name: 'X', address: 'Y' } as never)

    expect(buildingRepo.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { created_by: 'owner-1', owner_user_id: 'owner-1' },
    )
    expect(assignmentRepo.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user_id: 'owner-1', building_id: 'new-1' }),
    )
  })

  it('does not create an owner assignment for admin-created buildings', async () => {
    buildingRepo.insert.mockResolvedValue(building({ id: 'new-2' }))
    const { BuildingService } = await import('../../../server/services/buildings')

    await BuildingService.create(event(), user('admin'), { name: 'X', address: 'Y' } as never)

    expect(buildingRepo.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { created_by: 'admin-1', owner_user_id: null },
    )
    expect(assignmentRepo.insert).not.toHaveBeenCalled()
  })

  it('rolls back the building when owner assignment creation fails', async () => {
    buildingRepo.insert.mockResolvedValue(building({ id: 'new-3' }))
    assignmentRepo.insert.mockRejectedValue(new Error('boom'))
    buildingRepo.remove.mockResolvedValue(undefined)
    const { BuildingService } = await import('../../../server/services/buildings')

    await expect(
      BuildingService.create(event(), user('owner'), { name: 'X', address: 'Y' } as never),
    ).rejects.toThrow('boom')

    expect(buildingRepo.remove).toHaveBeenCalledWith(expect.anything(), 'new-3')
  })
})

describe('BuildingService owner scoped mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignmentRepo.findBuildingIdsByUser.mockResolvedValue(['b-1'])
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
    expect(buildingRepo.remove).toHaveBeenCalledWith(expect.anything(), 'b-1')
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
