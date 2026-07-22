import type { ApiSuccess } from '~/types/api'
import type { BillingWorkspaceBootstrap } from '~/types/billing'

export function useBillingWorkspaceBootstrap(
  buildingIdentifier: string,
  periodYear: number,
  periodMonth: number,
) {
  return useFetch<ApiSuccess<BillingWorkspaceBootstrap>>('/api/billing/workspace/bootstrap', {
    method: 'POST',
    key: `billing-workspace:${buildingIdentifier}:${periodYear}-${periodMonth}`,
    body: {
      building_id: buildingIdentifier,
      period_year: periodYear,
      period_month: periodMonth,
    },
  })
}
