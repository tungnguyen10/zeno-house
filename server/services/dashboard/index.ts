import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { DashboardSummary, DashboardSummaryMeta } from '~/types/dashboard'
import { DashboardRepository } from '../../repositories/dashboard'

export const DashboardService = {
  async getSummary(
    event: H3Event,
    user: AuthUser,
  ): Promise<{ data: DashboardSummary; meta: DashboardSummaryMeta }> {
    if (!can(user, 'dashboard.read')) throwForbidden('Không có quyền xem dashboard')
    const { summary, generatedAt } = await DashboardRepository.getSummary(event)
    return { data: summary, meta: { generatedAt } }
  },
}
