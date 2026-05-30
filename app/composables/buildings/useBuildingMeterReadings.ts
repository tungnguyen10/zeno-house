import type { RoomMeterStatus, MeterReading } from '~/types/meter-readings'
import type { ApiSuccess } from '~/types/api'
import type { MeterReadingBulkInput } from '~/utils/validators/meter-readings'

export function useBuildingMeterReadings(buildingId: string) {
  const isSaving = ref(false)
  const savedCount = ref(0)
  const saveErrors = ref<string[]>([])

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

  async function saveBulk(input: MeterReadingBulkInput['readings']): Promise<boolean> {
    isSaving.value = true
    savedCount.value = 0
    saveErrors.value = []
    try {
      const result = await $fetch<ApiSuccess<MeterReading[]> & { meta: { count: number } }>(
        '/api/meter-readings/bulk',
        { method: 'POST', body: { readings: input } },
      )
      savedCount.value = result.meta?.count ?? input.length
      await refresh()
      return true
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: { message?: string } } }
      saveErrors.value = [err?.data?.error?.message ?? 'Lưu thất bại']
      return false
    }
    finally {
      isSaving.value = false
    }
  }

  return {
    roomsStatus,
    isLoading: pending,
    error,
    isSaving,
    savedCount,
    saveErrors,
    periodYear,
    periodMonth,
    refresh,
    saveBulk,
  }
}
