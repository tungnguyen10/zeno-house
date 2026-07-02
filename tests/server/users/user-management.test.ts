import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can as realCan } from '../../../server/utils/permissions'

// Use the real capability map so target-role restrictions are actually enforced.
vi.stubGlobal('can', realCan)

const userRepo = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  listByRoles: vi.fn(),
  getById: vi.fn(),
}))
const assignmentRepo = vi.hoisted(() => ({
  insert: vi.fn(),
  findAll: vi.fn(),
  findByUser: vi.fn(),
}))
const buildingRepo = vi.hoisted(() => ({ findById: vi.fn() }))
const scope = vi.hoisted(() => ({
  getAssignedBuildingIds: vi.fn(),
  assertBuildingScope: vi.fn(),
}))

vi.mock('../../../server/repositories/users', () => ({ UserRepository: userRepo }))
vi.mock('../../../server/repositories/assignments', () => ({ AssignmentRepository: assignmentRepo }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../../server/utils/scope', () => scope)

function user(role: 'admin' | 'owner' | 'manager', id = `${role}-1`): AuthUser {
  return { id, app_metadata: { role } } as AuthUser
}

function event() {
  return { context: {} } as never
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    email: 'new@zeno.test',
    password: 'password123',
    full_name: 'New User',
    role: 'manager',
    building_ids: [],
    ...overrides,
  } as never
}

function assignment(buildingId: string, id = `a-${buildingId}`) {
  return {
    id,
    user_id: 'm-1',
    building_id: buildingId,
    can_delete_master_data: false,
    created_by: null,
    created_at: '',
    updated_at: '',
    building: null,
  }
}

describe('UserManagementService.createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userRepo.create.mockResolvedValue({ id: 'created-1', email: 'new@zeno.test', name: 'New User', role: 'manager' })
    buildingRepo.findById.mockResolvedValue({ id: 'b-1', name: 'Toa A' })
    assignmentRepo.insert.mockResolvedValue({ id: 'a-1' })
    scope.assertBuildingScope.mockResolvedValue(undefined)
  })

  it('lets admin create an owner', async () => {
    const { UserManagementService } = await import('../../../server/services/users')
    await UserManagementService.createUser(event(), user('admin'), input({ role: 'owner', building_ids: ['b-1'] }))
    expect(userRepo.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ role: 'owner' }))
    expect(assignmentRepo.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ building_id: 'b-1' }))
  })

  it('lets admin create a manager', async () => {
    const { UserManagementService } = await import('../../../server/services/users')
    await UserManagementService.createUser(event(), user('admin'), input({ role: 'manager', building_ids: ['b-1'] }))
    expect(userRepo.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ role: 'manager' }))
  })

  it('rejects creating an admin even for admin callers (403)', async () => {
    const { UserManagementService } = await import('../../../server/services/users')
    await expect(
      UserManagementService.createUser(event(), user('admin'), input({ role: 'admin' })),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.create).not.toHaveBeenCalled()
  })

  it('rejects owner creating an owner (403)', async () => {
    const { UserManagementService } = await import('../../../server/services/users')
    await expect(
      UserManagementService.createUser(event(), user('owner'), input({ role: 'owner', building_ids: ['b-1'] })),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.create).not.toHaveBeenCalled()
  })

  it('lets owner create a manager scoped to owner buildings', async () => {
    const { UserManagementService } = await import('../../../server/services/users')
    await UserManagementService.createUser(event(), user('owner'), input({ role: 'manager', building_ids: ['b-1'] }))
    expect(scope.assertBuildingScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'b-1', 'write')
    expect(userRepo.create).toHaveBeenCalled()
  })

  it('rejects owner-created manager without any building (422)', async () => {
    const { UserManagementService } = await import('../../../server/services/users')
    await expect(
      UserManagementService.createUser(event(), user('owner'), input({ role: 'manager', building_ids: [] })),
    ).rejects.toMatchObject({ statusCode: 422 })
    expect(userRepo.create).not.toHaveBeenCalled()
  })

  it('rejects owner-created manager with an out-of-scope building and creates nothing', async () => {
    scope.assertBuildingScope.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    const { UserManagementService } = await import('../../../server/services/users')
    await expect(
      UserManagementService.createUser(event(), user('owner'), input({ role: 'manager', building_ids: ['b-9'] })),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.create).not.toHaveBeenCalled()
  })

  it('rejects manager callers entirely (403)', async () => {
    const { UserManagementService } = await import('../../../server/services/users')
    await expect(
      UserManagementService.createUser(event(), user('manager'), input({ role: 'manager', building_ids: ['b-1'] })),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rolls back the created user when an assignment insert fails', async () => {
    assignmentRepo.insert.mockRejectedValue(new Error('boom'))
    userRepo.remove.mockResolvedValue(undefined)
    const { UserManagementService } = await import('../../../server/services/users')
    await expect(
      UserManagementService.createUser(event(), user('admin'), input({ role: 'manager', building_ids: ['b-1'] })),
    ).rejects.toThrow('boom')
    expect(userRepo.remove).toHaveBeenCalledWith(expect.anything(), 'created-1')
  })
})

describe('UserManagementService.listManageData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('admin sees owners and managers globally', async () => {
    userRepo.listByRoles.mockResolvedValue([
      { id: 'o-1', email: null, name: 'Owner', role: 'owner' },
      { id: 'm-1', email: null, name: 'Manager', role: 'manager' },
    ])
    assignmentRepo.findAll.mockResolvedValue([])
    const { UserManagementService } = await import('../../../server/services/users')
    const rows = await UserManagementService.listManageData(event(), user('admin'))

    expect(userRepo.listByRoles).toHaveBeenCalledWith(expect.anything(), ['owner', 'manager'])
    expect(assignmentRepo.findAll).toHaveBeenCalledWith(expect.anything(), null)
    expect(rows).toHaveLength(2)
  })

  it('owner sees only in-scope managers', async () => {
    scope.getAssignedBuildingIds.mockResolvedValue(['b-1'])
    userRepo.listByRoles.mockResolvedValue([
      { id: 'm-1', email: null, name: 'M1', role: 'manager' },
      { id: 'm-2', email: null, name: 'M2', role: 'manager' },
    ])
    assignmentRepo.findAll.mockResolvedValue([
      { id: 'a-1', user_id: 'm-1', building_id: 'b-1', can_delete_master_data: false, created_by: null, created_at: '', updated_at: '', building: null },
    ])
    const { UserManagementService } = await import('../../../server/services/users')
    const rows = await UserManagementService.listManageData(event(), user('owner'))

    expect(userRepo.listByRoles).toHaveBeenCalledWith(expect.anything(), ['manager'])
    expect(assignmentRepo.findAll).toHaveBeenCalledWith(expect.anything(), ['b-1'])
    // Only m-1 has an in-scope assignment.
    expect(rows).toHaveLength(1)
    expect(rows[0]?.user.id).toBe('m-1')
  })
})

describe('UserManagementService.updateUser/deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userRepo.getById.mockResolvedValue({ id: 'm-1', email: 'm@zeno.test', name: 'Manager', role: 'manager' })
    userRepo.update.mockResolvedValue({ id: 'm-1', email: 'updated@zeno.test', name: 'Updated', role: 'manager' })
    userRepo.remove.mockResolvedValue(undefined)
    scope.getAssignedBuildingIds.mockResolvedValue(['b-1'])
    assignmentRepo.findByUser.mockResolvedValue([assignment('b-1')])
  })

  it('lets admin update owner or manager users', async () => {
    userRepo.getById.mockResolvedValue({ id: 'o-1', email: 'o@zeno.test', name: 'Owner', role: 'owner' })
    const { UserManagementService } = await import('../../../server/services/users')

    await UserManagementService.updateUser(event(), user('admin'), 'o-1', {
      email: 'owner@zeno.test',
      full_name: 'Owner Updated',
      role: 'owner',
    })

    expect(userRepo.update).toHaveBeenCalledWith(expect.anything(), 'o-1', expect.objectContaining({ role: 'owner' }))
    expect(assignmentRepo.findByUser).not.toHaveBeenCalled()
  })

  it('rejects updating an admin target', async () => {
    userRepo.getById.mockResolvedValue({ id: 'admin-2', email: 'a@zeno.test', name: 'Admin', role: 'admin' })
    const { UserManagementService } = await import('../../../server/services/users')

    await expect(
      UserManagementService.updateUser(event(), user('admin'), 'admin-2', { email: 'new@zeno.test' }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.update).not.toHaveBeenCalled()
  })

  it('rejects changing a managed user into admin', async () => {
    const { UserManagementService } = await import('../../../server/services/users')

    await expect(
      UserManagementService.updateUser(event(), user('admin'), 'm-1', { role: 'admin' }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.update).not.toHaveBeenCalled()
  })

  it('lets owner update a manager assigned inside owner scope', async () => {
    const { UserManagementService } = await import('../../../server/services/users')

    await UserManagementService.updateUser(event(), user('owner'), 'm-1', {
      email: 'manager@zeno.test',
      full_name: 'Scoped Manager',
    })

    expect(scope.getAssignedBuildingIds).toHaveBeenCalled()
    expect(assignmentRepo.findByUser).toHaveBeenCalledWith(expect.anything(), 'm-1')
    expect(userRepo.update).toHaveBeenCalled()
  })

  it('rejects owner updating a manager outside owner scope', async () => {
    assignmentRepo.findByUser.mockResolvedValue([assignment('b-2')])
    const { UserManagementService } = await import('../../../server/services/users')

    await expect(
      UserManagementService.updateUser(event(), user('owner'), 'm-1', { email: 'manager@zeno.test' }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.update).not.toHaveBeenCalled()
  })

  it('rejects owner updating an owner target', async () => {
    userRepo.getById.mockResolvedValue({ id: 'o-1', email: 'o@zeno.test', name: 'Owner', role: 'owner' })
    const { UserManagementService } = await import('../../../server/services/users')

    await expect(
      UserManagementService.updateUser(event(), user('owner'), 'o-1', { email: 'owner@zeno.test' }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.update).not.toHaveBeenCalled()
  })

  it('lets admin delete owner or manager users', async () => {
    userRepo.getById.mockResolvedValue({ id: 'o-1', email: 'o@zeno.test', name: 'Owner', role: 'owner' })
    const { UserManagementService } = await import('../../../server/services/users')

    await UserManagementService.deleteUser(event(), user('admin'), 'o-1')

    expect(userRepo.remove).toHaveBeenCalledWith(expect.anything(), 'o-1')
    expect(assignmentRepo.findByUser).not.toHaveBeenCalled()
  })

  it('lets owner delete a manager assigned only inside owner scope', async () => {
    const { UserManagementService } = await import('../../../server/services/users')

    await UserManagementService.deleteUser(event(), user('owner'), 'm-1')

    expect(userRepo.remove).toHaveBeenCalledWith(expect.anything(), 'm-1')
  })

  it('rejects owner deleting a manager that also has outside-scope assignments', async () => {
    assignmentRepo.findByUser.mockResolvedValue([assignment('b-1'), assignment('b-2', 'a-b-2')])
    const { UserManagementService } = await import('../../../server/services/users')

    await expect(
      UserManagementService.deleteUser(event(), user('owner'), 'm-1'),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(userRepo.remove).not.toHaveBeenCalled()
  })
})
