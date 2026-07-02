import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { AssignmentBuilding, UserBuildingAssignment } from '~/types/assignments'
import type { ManagedUserWithAssignments } from '~/types/users'
import type { AssignmentCreateInput, AssignmentUpdateInput } from '~/utils/validators/assignments'
import { ROLES } from '~/utils/constants/roles'
import { AssignmentRepository } from '../../repositories/assignments'
import { BuildingRepository } from '../../repositories/buildings'
import { UserRepository } from '../../repositories/users'
import { getAssignedBuildingIds, assertBuildingScope } from '../../utils/scope'
import { UserManagementService } from '../users'

function assertCanManageUsers(actor: AuthUser): void {
  if (!can(actor, 'users.manage.global') && !can(actor, 'users.manage.scoped')) {
    throwForbidden('Không có quyền quản lý phân quyền')
  }
}

/**
 * Scoped callers (owner) may only manage manager assignments. This guards
 * against an owner mutating another owner's assignment that happens to fall in
 * their building scope.
 */
async function assertManageableTarget(
  event: H3Event,
  actor: AuthUser,
  userId: string,
): Promise<void> {
  if (can(actor, 'users.manage.global')) return
  const target = await UserRepository.getById(event, userId)
  if (!target || target.role !== ROLES.MANAGER) {
    throwForbidden('Chỉ được quản lý phân quyền của quản lý (manager)')
  }
}

export const AssignmentService = {
  async list(event: H3Event, actor: AuthUser): Promise<ManagedUserWithAssignments[]> {
    return UserManagementService.listManageData(event, actor)
  },

  async buildingsWithoutManager(event: H3Event, actor: AuthUser): Promise<AssignmentBuilding[]> {
    assertCanManageUsers(actor)
    const scope = can(actor, 'users.manage.global') ? null : await getAssignedBuildingIds(event, actor)
    return AssignmentRepository.findBuildingsWithoutManager(event, scope)
  },

  async create(
    event: H3Event,
    actor: AuthUser,
    input: AssignmentCreateInput,
  ): Promise<UserBuildingAssignment> {
    assertCanManageUsers(actor)

    const building = await BuildingRepository.findById(event, input.building_id)
    if (!building) {
      throwValidationError('Tòa nhà không tồn tại', {
        fieldErrors: { building_id: ['Tòa nhà không hợp lệ'] },
        formErrors: [],
      })
    }
    await assertBuildingScope(event, actor, input.building_id, 'write')
    await assertManageableTarget(event, actor, input.user_id)

    return AssignmentRepository.insert(event, { ...input, created_by: actor.id })
  },

  async update(
    event: H3Event,
    actor: AuthUser,
    id: string,
    input: AssignmentUpdateInput,
  ): Promise<UserBuildingAssignment> {
    assertCanManageUsers(actor)

    const existing = await AssignmentRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy phân quyền')
    await assertBuildingScope(event, actor, existing.building_id, 'write')
    await assertManageableTarget(event, actor, existing.user_id)

    return AssignmentRepository.update(event, id, input)
  },

  async remove(event: H3Event, actor: AuthUser, id: string): Promise<void> {
    assertCanManageUsers(actor)

    const existing = await AssignmentRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy phân quyền')
    await assertBuildingScope(event, actor, existing.building_id, 'write')
    await assertManageableTarget(event, actor, existing.user_id)

    await AssignmentRepository.remove(event, id)
  },
}
