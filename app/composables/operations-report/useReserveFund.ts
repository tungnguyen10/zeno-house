import type { ApiSuccess } from '~/types/api'
import type { ReserveFund } from '~/types/operations-report'

export function useReserveFund(buildingId: Ref<string | null>) {
  const url = computed(() => `/api/reserve-funds/${buildingId.value ?? '00000000-0000-0000-0000-000000000000'}`)

  const { data, status, error, refresh } = useFetch<ApiSuccess<ReserveFund>>(url, {
    immediate: false,
    watch: false,
  })

  watch(buildingId, () => {
    if (buildingId.value) refresh()
  }, { immediate: true })

  return {
    reserveFund: computed(() => data.value?.data ?? null),
    reserveFundLoading: computed(() => status.value === 'pending'),
    reserveFundError: error,
    refreshReserveFund: refresh,
  }
}
