import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ManagedUser, ManagedUserWithAssignments } from '~/types/users'
import type { UserCreateInput, UserUpdateInput } from '~/utils/validators/users'
import type { UserRole } from '~/utils/constants/roles'
import { ROLES } from '~/utils/constants/roles'
import { UserRepository } from '../../repositories/users'
import { AssignmentRepository } from '../../repositories/assignments'
import { BuildingRepository } from '../../repositories/buildings'
import { getAssignedBuildingIds, assertBuildingScope } from '../../utils/scope'

const CREATE_CAPABILITY: Record<UserRole, string> = {
  admin: 'users.create.admin',
  owner: 'users.create.owner',
  manager: 'users.create.manager',
}

/** Roles a global manager (admin) can see in user management. */
const GLOBAL_MANAGED_ROLES: UserRole[] = [ROLES.OWNER, ROLES.MANAGER]
/** Roles a scoped manager (owner) can see/manage in user management. */
const SCOPED_MANAGED_ROLES: UserRole[] = [ROLES.MANAGER]

function assertCanManageUsers(actor: AuthUser): void {
  if (!can(actor, 'users.manage.global') && !can(actor, 'users.manage.scoped')) {
    throwForbidden('Không có quyền quản lý người dùng')
  }
}

async function assertManagedTarget(
  event: H3Event,
  actor: AuthUser,
  id: string,
  mode: 'write' | 'delete',
): Promise<ManagedUser> {
  const target = await UserRepository.getById(event, id)
  if (!target) throwNotFound('Không tìm thấy người dùng')
  if (target.role === ROLES.ADMIN || !GLOBAL_MANAGED_ROLES.includes(target.role)) {
    throwForbidden('Không thể quản lý admin từ ứng dụng')
  }

  if (can(actor, 'users.manage.global')) return target

  if (target.role !== ROLES.MANAGER) {
    throwForbidden('Owner chỉ được quản lý manager')
  }

  const scope = await getAssignedBuildingIds(event, actor)
  if (scope === null || scope.length === 0) {
    throwForbidden('Không có tòa nhà trong phạm vi quản lý')
  }

  const scopeSet = new Set(scope)
  const assignments = await AssignmentRepository.findByUser(event, target.id)
  const hasInScopeAssignment = assignments.some(assignment => scopeSet.has(assignment.building_id))
  if (!hasInScopeAssignment) {
    throwForbidden('Người dùng nằm ngoài phạm vi quản lý')
  }

  if (mode === 'delete') {
    const hasOutsideScopeAssignment = assignments.some(assignment => !scopeSet.has(assignment.building_id))
    if (hasOutsideScopeAssignment) {
      throwForbidden('Không thể xoá manager còn thuộc tòa nhà ngoài phạm vi')
    }
  }

  return target
}

export const UserManagementService = {
  /**
   * List managed users with their assignments. Admin sees all owners/managers
   * globally; owner sees only managers assigned inside owner scope.
   */
  async listManageData(
    event: H3Event,
    actor: AuthUser,
  ): Promise<ManagedUserWithAssignments[]> {
    assertCanManageUsers(actor)

    const global = can(actor, 'users.manage.global')
    const roles = global ? GLOBAL_MANAGED_ROLES : SCOPED_MANAGED_ROLES
    const scope = global ? null : await getAssignedBuildingIds(event, actor)

    const [users, assignments] = await Promise.all([
      UserRepository.listByRoles(event, roles),
      AssignmentRepository.findAll(event, scope),
    ])

    const byUser = new Map<string, ManagedUserWithAssignments['assignments']>()
    for (const assignment of assignments) {
      const items = byUser.get(assignment.user_id) ?? []
      items.push(assignment)
      byUser.set(assignment.user_id, items)
    }

    const result = users.map(user => ({
      user,
      assignments: byUser.get(user.id) ?? [],
    }))

    // Scoped managers only surface if they have at least one in-scope assignment.
    if (!global) {
      return result.filter(row => row.assignments.length > 0)
    }
    return result
  },

  /**
   * Create an owner or manager user with an email/password credential and
   * optional building assignments. Rejects admin creation. Owner callers may
   * only create managers scoped to their own buildings.
   */
  async createUser(
    event: H3Event,
    actor: AuthUser,
    input: UserCreateInput,
  ): Promise<ManagedUser> {
    assertCanManageUsers(actor)

    const capability = CREATE_CAPABILITY[input.role]
    if (!capability || !can(actor, capability)) {
      throwForbidden('Không có quyền tạo người dùng với vai trò này')
    }

    const scoped = !can(actor, 'users.manage.global')

    // Owner-created managers must have at least one building assignment (in scope).
    if (scoped && input.building_ids.length === 0) {
      throwValidationError('Phải chọn ít nhất một tòa nhà cho quản lý', {
        fieldErrors: { building_ids: ['Bắt buộc'] },
        formErrors: [],
      })
    }

    // Validate every requested building exists and, for scoped callers, is in scope.
    // Scope check happens before any user creation so mixed-scope requests create nothing.
    const uniqueBuildingIds = [...new Set(input.building_ids)]
    for (const buildingId of uniqueBuildingIds) {
      const building = await BuildingRepository.findById(event, buildingId)
      if (!building) {
        throwValidationError('Tòa nhà không tồn tại', {
          fieldErrors: { building_ids: ['Tòa nhà không hợp lệ'] },
          formErrors: [],
        })
      }
      if (scoped) {
        await assertBuildingScope(event, actor, buildingId, 'write')
      }
    }

    const created = await UserRepository.create(event, {
      email: input.email,
      password: input.password,
      full_name: input.full_name,
      role: input.role,
    })

    try {
      for (const buildingId of uniqueBuildingIds) {
        await AssignmentRepository.insert(event, {
          user_id: created.id,
          building_id: buildingId,
          created_by: actor.id,
        })
      }
    }
    catch (err) {
      // Roll back the auth user so we never leave an orphaned/inaccessible account.
      await UserRepository.remove(event, created.id).catch(() => {})
      throw err
    }

    return created
  },

  async updateUser(
    event: H3Event,
    actor: AuthUser,
    id: string,
    input: UserUpdateInput,
  ): Promise<ManagedUser> {
    assertCanManageUsers(actor)
    await assertManagedTarget(event, actor, id, 'write')

    if (input.role === ROLES.ADMIN) {
      throwForbidden('Không thể chuyển người dùng thành admin từ ứng dụng')
    }
    if (!can(actor, 'users.manage.global') && input.role && input.role !== ROLES.MANAGER) {
      throwForbidden('Owner chỉ được quản lý manager')
    }

    return UserRepository.update(event, id, input)
  },

  async deleteUser(event: H3Event, actor: AuthUser, id: string): Promise<void> {
    assertCanManageUsers(actor)
    await assertManagedTarget(event, actor, id, 'delete')
    await UserRepository.remove(event, id)
  },
}
