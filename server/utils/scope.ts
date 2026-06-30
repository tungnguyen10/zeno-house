import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { AssignmentRepository } from '../repositories/assignments'

export type ScopeMode = 'read' | 'write'

export async function getAssignedBuildingIds(
  event: H3Event,
  user: AuthUser,
): Promise<string[] | null> {
  if (user.app_metadata.role === 'admin') return null

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
  if (user.app_metadata.role === 'admin') return true

  const assignment = await AssignmentRepository.findByUserAndBuilding(event, user.id, buildingId)
  return assignment?.can_delete_master_data === true
}
