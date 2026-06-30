import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { DashboardSummary, DashboardSummaryMeta } from '~/types/dashboard'
import { DashboardRepository } from '../../repositories/dashboard'
import { getAssignedBuildingIds } from '../../utils/scope'

export const DashboardService = {
  async getSummary(
    event: H3Event,
    user: AuthUser,
  ): Promise<{ data: DashboardSummary; meta: DashboardSummaryMeta }> {
    if (!can(user, 'dashboard.read')) throwForbidden('Không có quyền xem dashboard')
    const buildingIds = await getAssignedBuildingIds(event, user)
    const { summary, generatedAt } = await DashboardRepository.getSummary(event, buildingIds)
    return { data: summary, meta: { generatedAt } }
  },
}
