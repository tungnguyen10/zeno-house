import type { RoomMeterStatus } from '~/types/meter-readings'
import type { ApiSuccess } from '~/types/api'

export function useBuildingMeterReadings(buildingId: string) {
  const periodYear = ref(new Date().getFullYear())
  const periodMonth = ref(new Date().getMonth() + 1)

  const { data, pending, error, refresh } = useFetch<ApiSuccess<RoomMeterStatus[]>>(
    '/api/meter-readings/bulk',
    {
      query: computed(() => ({
        building_id: buildingId,
        period_year: periodYear.value,
        period_month: periodMonth.value,
      })),
    },
  )

  const roomsStatus = computed(() => data.value?.data ?? [])

  return {
    roomsStatus,
    isLoading: pending,
    error,
    periodYear,
    periodMonth,
    refresh,
  }
}
