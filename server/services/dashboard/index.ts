import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { DashboardSummary, DashboardSummaryMeta } from '~/types/dashboard'
import { DashboardRepository } from '../../repositories/dashboard'
import { getAssignedBuildingIds } from '../../utils/scope'
import { TtlCache } from '../../utils/ttl-cache'

type DashboardResult = Awaited<ReturnType<typeof DashboardRepository.getSummary>>
const dashboardCache = new TtlCache<DashboardResult>(250)
const DASHBOARD_CACHE_TTL_MS = 20_000

function dashboardCacheKey(buildingIds: string[] | null): string {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const scope = buildingIds === null ? 'all' : [...buildingIds].sort().join(',')
  return `${period}:${scope}`
}

export const DashboardService = {
  async getSummary(
    event: H3Event,
    user: AuthUser,
  ): Promise<{ data: DashboardSummary; meta: DashboardSummaryMeta }> {
    if (!can(user, 'dashboard.read')) throwForbidden('Không có quyền xem dashboard')
    const buildingIds = await getAssignedBuildingIds(event, user)
    const cacheKey = dashboardCacheKey(buildingIds)
    let result = dashboardCache.get(cacheKey)
    if (!result) {
      result = await DashboardRepository.getSummary(event, buildingIds)
      dashboardCache.set(cacheKey, result, DASHBOARD_CACHE_TTL_MS)
    }
    const { summary, generatedAt } = result
    return { data: summary, meta: { generatedAt } }
  },
}

export function clearDashboardSummaryCache(): void {
  dashboardCache.clear()
}
