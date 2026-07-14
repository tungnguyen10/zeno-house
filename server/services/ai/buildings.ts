import type { H3Event } from 'h3'
import type { AiBuildingResolution, AiBuildingSummary } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AiBuildingRepository } from '../../repositories/ai/buildings'
import { can } from '../../utils/permissions'
import { getAssignedBuildingIds } from '../../utils/scope'

export const AiBuildingService = {
  async list(event: H3Event, user: AuthUser): Promise<AiBuildingSummary[]> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem danh sách tòa nhà')
    const buildingIds = await getAssignedBuildingIds(event, user)
    return AiBuildingRepository.listScoped(event, buildingIds)
  },

  async resolve(event: H3Event, user: AuthUser, reference: string): Promise<AiBuildingResolution> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem tòa nhà')
    const buildingIds = await getAssignedBuildingIds(event, user)
    const matches = await AiBuildingRepository.resolveScoped(event, reference, buildingIds)
    if (matches.length === 0) return { status: 'not_found' }
    if (matches.length > 1) return { status: 'ambiguous', candidates: matches }
    return { status: 'resolved', building: matches[0]! }
  },
}
