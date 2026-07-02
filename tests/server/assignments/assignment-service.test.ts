import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can as realCan } from '../../../server/utils/permissions'

vi.stubGlobal('can', realCan)

const assignmentRepo = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findById: vi.fn(),
  findBuildingsWithoutManager: vi.fn(),
}))
const buildingRepo = vi.hoisted(() => ({ findById: vi.fn() }))
const userRepo = vi.hoisted(() => ({ getById: vi.fn() }))
const scope = vi.hoisted(() => ({
  getAssignedBuildingIds: vi.fn(),
  assertBuildingScope: vi.fn(),
}))
const usersService = vi.hoisted(() => ({ UserManagementService: { listManageData: vi.fn() } }))
const auditService = vi.hoisted(() => ({ append: vi.fn(), appendBulk: vi.fn() }))

vi.mock('../../../server/repositories/assignments', () => ({ AssignmentRepository: assignmentRepo }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../../server/repositories/users', () => ({ UserRepository: userRepo }))
vi.mock('../../../server/utils/scope', () => scope)
vi.mock('../../../server/services/users', () => usersService)
vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))

function user(role: 'admin' | 'owner' | 'manager', id = `${role}-1`): AuthUser {
  return { id, app_metadata: { role } } as AuthUser
}
function event() {
  return { context: {} } as never
}

describe('AssignmentService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildingRepo.findById.mockResolvedValue({ id: 'b-1', name: 'Toa A' })
    scope.assertBuildingScope.mockResolvedValue(undefined)
    userRepo.getById.mockResolvedValue({ id: 'm-1', role: 'manager' })
    assignmentRepo.insert.mockResolvedValue({ id: 'a-1', user_id: 'm-1', building_id: 'b-1' })
  })

  it('lets admin assign any building', async () => {
    const { AssignmentService } = await import('../../../server/services/assignments')
    await AssignmentService.create(event(), user('admin'), { user_id: 'm-1', building_id: 'b-1' } as never)
    expect(assignmentRepo.insert).toHaveBeenCalled()
    expect(auditService.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: 'user.assignment_added', entity_type: 'user', entity_id: 'm-1', building_id: 'b-1' }),
    )
  })

  it('lets owner assign a manager inside scope', async () => {
    const { AssignmentService } = await import('../../../server/services/assignments')
    await AssignmentService.create(event(), user('owner'), { user_id: 'm-1', building_id: 'b-1' } as never)
    expect(scope.assertBuildingScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'b-1', 'write')
    expect(assignmentRepo.insert).toHaveBeenCalled()
  })

  it('forbids owner assigning outside scope (403)', async () => {
    scope.assertBuildingScope.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const { AssignmentService } = await import('../../../server/services/assignments')
    await expect(
      AssignmentService.create(event(), user('owner'), { user_id: 'm-1', building_id: 'b-9' } as never),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(assignmentRepo.insert).not.toHaveBeenCalled()
  })

  it('forbids owner managing a non-manager target (403)', async () => {
    userRepo.getById.mockResolvedValue({ id: 'o-2', role: 'owner' })
    const { AssignmentService } = await import('../../../server/services/assignments')
    await expect(
      AssignmentService.create(event(), user('owner'), { user_id: 'o-2', building_id: 'b-1' } as never),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(assignmentRepo.insert).not.toHaveBeenCalled()
  })

  it('forbids manager callers (403)', async () => {
    const { AssignmentService } = await import('../../../server/services/assignments')
    await expect(
      AssignmentService.create(event(), user('manager'), { user_id: 'm-1', building_id: 'b-1' } as never),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('AssignmentService.remove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignmentRepo.findById.mockResolvedValue({ id: 'a-1', user_id: 'm-1', building_id: 'b-1' })
    scope.assertBuildingScope.mockResolvedValue(undefined)
    userRepo.getById.mockResolvedValue({ id: 'm-1', role: 'manager' })
  })

  it('lets owner remove a scoped manager assignment', async () => {
    const { AssignmentService } = await import('../../../server/services/assignments')
    await AssignmentService.remove(event(), user('owner'), 'a-1')
    expect(assignmentRepo.remove).toHaveBeenCalledWith(expect.anything(), 'a-1')
    expect(auditService.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: 'user.assignment_removed', entity_type: 'user', entity_id: 'm-1', building_id: 'b-1' }),
    )
  })

  it('forbids owner removing an out-of-scope assignment (403)', async () => {
    scope.assertBuildingScope.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const { AssignmentService } = await import('../../../server/services/assignments')
    await expect(AssignmentService.remove(event(), user('owner'), 'a-1'))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(assignmentRepo.remove).not.toHaveBeenCalled()
  })

  it('404 when the assignment does not exist', async () => {
    assignmentRepo.findById.mockResolvedValue(null)
    const { AssignmentService } = await import('../../../server/services/assignments')
    await expect(AssignmentService.remove(event(), user('admin'), 'missing'))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('AssignmentService.update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignmentRepo.findById.mockResolvedValue({ id: 'a-1', user_id: 'm-1', building_id: 'b-1' })
    assignmentRepo.update.mockResolvedValue({ id: 'a-1', user_id: 'm-1', building_id: 'b-1', can_delete_master_data: true })
    scope.assertBuildingScope.mockResolvedValue(undefined)
    userRepo.getById.mockResolvedValue({ id: 'm-1', role: 'manager' })
  })

  it('lets owner toggle a scoped manager assignment', async () => {
    const { AssignmentService } = await import('../../../server/services/assignments')
    await AssignmentService.update(event(), user('owner'), 'a-1', { can_delete_master_data: true } as never)
    expect(scope.assertBuildingScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'b-1', 'write')
    expect(assignmentRepo.update).toHaveBeenCalledWith(expect.anything(), 'a-1', { can_delete_master_data: true })
  })

  it('forbids owner toggling an out-of-scope assignment (403)', async () => {
    scope.assertBuildingScope.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const { AssignmentService } = await import('../../../server/services/assignments')
    await expect(
      AssignmentService.update(event(), user('owner'), 'a-1', { can_delete_master_data: true } as never),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(assignmentRepo.update).not.toHaveBeenCalled()
  })
})

describe('AssignmentService.list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersService.UserManagementService.listManageData.mockResolvedValue([])
  })

  it('delegates assignment visibility to scoped user-management rules', async () => {
    const { AssignmentService } = await import('../../../server/services/assignments')
    await AssignmentService.list(event(), user('admin'))
    await AssignmentService.list(event(), user('owner'))

    expect(usersService.UserManagementService.listManageData).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ app_metadata: { role: 'admin' } }))
    expect(usersService.UserManagementService.listManageData).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ app_metadata: { role: 'owner' } }))
  })
})

describe('AssignmentService.buildingsWithoutManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignmentRepo.findBuildingsWithoutManager.mockResolvedValue([])
  })

  it('is global for admin (null scope)', async () => {
    const { AssignmentService } = await import('../../../server/services/assignments')
    await AssignmentService.buildingsWithoutManager(event(), user('admin'))
    expect(assignmentRepo.findBuildingsWithoutManager).toHaveBeenCalledWith(expect.anything(), null)
  })

  it('is scoped for owner', async () => {
    scope.getAssignedBuildingIds.mockResolvedValue(['b-1'])
    const { AssignmentService } = await import('../../../server/services/assignments')
    await AssignmentService.buildingsWithoutManager(event(), user('owner'))
    expect(assignmentRepo.findBuildingsWithoutManager).toHaveBeenCalledWith(expect.anything(), ['b-1'])
  })
})
