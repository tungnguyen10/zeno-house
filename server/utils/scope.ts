import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { AssignmentRepository } from '../repositories/assignments'

export type ScopeMode = 'read' | 'write'

export async function getAssignedBuildingIds(
  event: H3Event,
  user: AuthUser,
): Promise<string[] | null> {
  // Admin is global/unscoped. Owner and manager are scoped to their assignments;
  // a scoped user with no assignments resolves to an empty list (not global data).
  if (isAdmin(user)) return null

  if (event.context.__buildingScope !== undefined) {
    return event.context.__buildingScope
  }

  const ids = await AssignmentRepository.findBuildingIdsByUser(event, user.id)
  event.context.__buildingScope = ids
  return ids
}

export async function assertBuildingScope(
  event: H3Event,
  user: AuthUser,
  buildingId: string,
  mode: ScopeMode,
): Promise<void> {
  const buildingIds = await getAssignedBuildingIds(event, user)
  if (buildingIds === null || buildingIds.includes(buildingId)) return

  if (mode === 'read') {
    throwNotFound('Không tìm thấy')
  }

  throwForbidden('Không có quyền thao tác với tòa nhà này')
}

export async function canDeleteMasterData(
  event: H3Event,
  user: AuthUser,
  buildingId: string,
): Promise<boolean> {
  if (isAdmin(user)) return true

  // Owners fully control master data in buildings within their scope. The
  // per-assignment `can_delete_master_data` flag is a manager-only grant.
  if (isOwner(user)) {
    const buildingIds = await getAssignedBuildingIds(event, user)
    return buildingIds === null || buildingIds.includes(buildingId)
  }

  const assignment = await AssignmentRepository.findByUserAndBuilding(event, user.id, buildingId)
  return assignment?.can_delete_master_data === true
}
