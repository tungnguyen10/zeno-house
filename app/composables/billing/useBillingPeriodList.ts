import type { ApiSuccess } from '~/types/api'
import type {
  BillingPeriodSummary,
  BillingPeriodListFilters,
  BillingPeriod,
} from '~/types/billing'

/**
 * List billing periods with optional filters. The list is the entry into the
 * monthly operations workspace.
 */
export function useBillingPeriodList(initial: BillingPeriodListFilters = {}) {
  const filters = reactive<BillingPeriodListFilters>({ ...initial })

  const query = computed(() => {
    const q: Record<string, string | number | boolean> = {}
    if (filters.building_id) q.building_id = filters.building_id
    if (filters.period_year !== undefined) q.period_year = filters.period_year
    if (filters.period_month !== undefined) q.period_month = filters.period_month
    if (filters.status) q.status = filters.status
    if (filters.has_debt !== undefined) q.has_debt = filters.has_debt
    return q
  })

  const { data, status, error, refresh } = useFetch<ApiSuccess<BillingPeriodSummary[]>>(
    '/api/billing/periods',
    { query, watch: [query] },
  )

  const periods = computed(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function openPeriod(input: { building_id: string; period_year: number; period_month: number }): Promise<BillingPeriod> {
    const resp = await apiFetch<ApiSuccess<BillingPeriod>>('/api/billing/periods', {
      method: 'POST',
      body: input,
    })
    await refresh()
    return resp.data
  }

  return {
    filters,
    periods,
    isLoading,
    error,
    refresh,
    openPeriod,
  }
}
