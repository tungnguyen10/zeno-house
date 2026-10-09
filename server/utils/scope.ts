import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { AssignmentRepository } from '../repositories/assignments'
import { BuildingVisibilityRepository } from '../repositories/buildings/visibility'
import { getTenantIdForAuthUser } from '../repositories/tenant-portal/links'

export type ScopeMode = 'read' | 'write'

export async function resolveTenantId(event: H3Event, user: AuthUser): Promise<string> {
  const cache = event.context.__tenantScope ??= new Map()
  let lookup = cache.get(user.id)
  if (!lookup) {
    lookup = getTenantIdForAuthUser(event, user.id)
    cache.set(user.id, lookup)
  }
  const tenantId = await lookup
  if (!tenantId) throwNotFound('Không tìm thấy')
  return tenantId
}

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

async function getHiddenBuildingIds(event: H3Event): Promise<string[]> {
  if (event.context.__hiddenBuildingIds !== undefined) {
    return event.context.__hiddenBuildingIds
  }
  const ids = await BuildingVisibilityRepository.findHiddenIds(event)
  event.context.__hiddenBuildingIds = ids
  return ids
}

/**
 * Visibility-aware building scope for browsable lists and aggregates.
 *
 * Deliberately separate from `getAssignedBuildingIds`: permission scope decides
 * whether a record resolves at all, visibility only decides whether it shows up
 * in a collection. Keeping them apart is what lets a direct link to a record in
 * a hidden building keep working.
 */
export async function getVisibleBuildingIds(
  event: H3Event,
  user: AuthUser,
): Promise<string[] | null> {
  if (event.context.__visibleBuildingScope !== undefined) {
    return event.context.__visibleBuildingScope
  }

  const assigned = await getAssignedBuildingIds(event, user)
  const hidden = await getHiddenBuildingIds(event)

  let visible: string[] | null
  if (assigned === null) {
    // Admin stays unscoped while nothing is hidden, so the common case keeps
    // skipping the `in (...)` filter entirely.
    visible = hidden.length === 0 ? null : await BuildingVisibilityRepository.findVisibleIds(event)
  }
  else {
    const hiddenSet = new Set(hidden)
    visible = assigned.filter(id => !hiddenSet.has(id))
  }

  event.context.__visibleBuildingScope = visible
  return visible
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
