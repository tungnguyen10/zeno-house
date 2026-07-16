import type { H3Event } from 'h3'
import { uuidv7 } from 'uuidv7'
import type { AuthUser } from '~/types/auth'
import type { ManagedUser, ManagedUserWithAssignments } from '~/types/users'
import type { UserCreateInput, UserUpdateInput } from '~/utils/validators/users'
import type { UserRole } from '~/utils/constants/roles'
import { ROLES } from '~/utils/constants/roles'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { UserRepository } from '../../repositories/users'
import { AssignmentRepository } from '../../repositories/assignments'
import { BuildingRepository } from '../../repositories/buildings'
import { getAssignedBuildingIds, assertBuildingScope } from '../../utils/scope'
import { AuditService } from '../audit'

const CREATE_CAPABILITY: Record<UserCreateInput['role'], string> = {
  admin: 'users.create.admin',
  owner: 'users.create.owner',
  manager: 'users.create.manager',
}

/** Roles a global manager (admin) can see in user management. */
const GLOBAL_MANAGED_ROLES: UserRole[] = [ROLES.OWNER, ROLES.MANAGER]
/** Roles a scoped manager (owner) can see/manage in user management. */
const SCOPED_MANAGED_ROLES: UserRole[] = [ROLES.MANAGER]

/**
 * Emit a user lifecycle audit event, fanned out to one event per associated
 * building so scoped roles can query it under their building; multi-building
 * events share a correlation id. A user with no assignments logs one event with
 * a null building_id (visible to admin's global feed only).
 */
async function auditUserLifecycle(
  event: H3Event,
  actor: AuthUser,
  action: string,
  target: ManagedUser,
  buildingIds: string[],
  data: { before?: unknown; after?: unknown; metadata?: Record<string, unknown> },
): Promise<void> {
  const correlationId = buildingIds.length > 1 ? uuidv7() : null
  const targets: (string | null)[] = buildingIds.length > 0 ? buildingIds : [null]
  for (const buildingId of targets) {
    await AuditService.append(event, actor, {
      building_id: buildingId,
      action,
      entity_type: 'user',
      entity_id: target.id,
      correlation_id: correlationId,
      before_data: data.before,
      after_data: data.after,
      metadata: { ...(data.metadata ?? {}), building_ids: buildingIds },
    })
  }
}

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

  // Owners may manage managers they created (durable link) or managers assigned
  // inside their building scope.
  const createdByActor = target.createdBy === actor.id
  const scope = await getAssignedBuildingIds(event, actor)
  const scopeSet = new Set(scope ?? [])
  const assignments = await AssignmentRepository.findByUser(event, target.id)
  const hasInScopeAssignment = assignments.some(assignment => scopeSet.has(assignment.building_id))
  if (!createdByActor && !hasInScopeAssignment) {
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

    // Scoped managers surface when they have an in-scope assignment or were
    // created by the actor (owners always see the managers they created).
    if (!global) {
      return result.filter(
        row => row.assignments.length > 0 || row.user.createdBy === actor.id,
      )
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
      created_by: actor.id,
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

    await auditUserLifecycle(event, actor, AUDIT_ACTIONS.USER_CREATED, created, uniqueBuildingIds, {
      after: created,
      metadata: { role: created.role, email: created.email },
    })

    return created
  },

  async updateUser(
    event: H3Event,
    actor: AuthUser,
    id: string,
    input: UserUpdateInput,
  ): Promise<ManagedUser> {
    assertCanManageUsers(actor)
    const target = await assertManagedTarget(event, actor, id, 'write')

    if (input.role === ROLES.ADMIN) {
      throwForbidden('Không thể chuyển người dùng thành admin từ ứng dụng')
    }
    if (!can(actor, 'users.manage.global') && input.role && input.role !== ROLES.MANAGER) {
      throwForbidden('Owner chỉ được quản lý manager')
    }

    const updated = await UserRepository.update(event, id, input)

    const assignments = await AssignmentRepository.findByUser(event, id)
    const buildingIds = assignments.map(assignment => assignment.building_id)
    const roleChanged = Boolean(input.role) && input.role !== target.role
    await auditUserLifecycle(
      event,
      actor,
      roleChanged ? AUDIT_ACTIONS.USER_ROLE_CHANGED : AUDIT_ACTIONS.USER_UPDATED,
      updated,
      buildingIds,
      {
        before: target,
        after: updated,
        metadata: roleChanged ? { from: target.role, to: updated.role } : undefined,
      },
    )

    return updated
  },

  async deleteUser(event: H3Event, actor: AuthUser, id: string): Promise<void> {
    assertCanManageUsers(actor)
    const target = await assertManagedTarget(event, actor, id, 'delete')

    const assignments = await AssignmentRepository.findByUser(event, id)
    const buildingIds = assignments.map(assignment => assignment.building_id)

    await UserRepository.remove(event, id)

    await auditUserLifecycle(event, actor, AUDIT_ACTIONS.USER_REMOVED, target, buildingIds, {
      before: target,
      metadata: { role: target.role, email: target.email },
    })
  },
}
