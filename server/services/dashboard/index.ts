import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { DashboardSummary } from '~/types/dashboard'
import { DashboardRepository } from '../../repositories/dashboard'

export const DashboardService = {
  async getSummary(event: H3Event, user: AuthUser): Promise<DashboardSummary> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem dashboard')
    return DashboardRepository.getSummary(event)
  },
}
