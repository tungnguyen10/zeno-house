import type { ApiSuccess } from '~/types/api'

export interface BillingPeriodSummary {
  id: string
  buildingId: string
  buildingName: string
  periodYear: number
  periodMonth: number
  status: string
  itemCount: number
  paidCount: number
  totalAmount: number
}

export function useBillingOverview() {
  const buildingFilter = ref('')
  const yearFilter = ref(new Date().getFullYear())

  const url = computed(() => {
    const params = new URLSearchParams()
    if (buildingFilter.value) params.set('building_id', buildingFilter.value)
    if (yearFilter.value) params.set('year', String(yearFilter.value))
    return `/api/billing-periods/summary?${params.toString()}`
  })

  const { data, status, refresh } = useFetch<ApiSuccess<BillingPeriodSummary[]>>(url, {
    watch: [url],
  })

  const periods = computed(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  return {
    periods,
    isLoading,
    buildingFilter,
    yearFilter,
    refresh,
  }
}
