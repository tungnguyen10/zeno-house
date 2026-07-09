import type { MeterReading, BulkReadingInput } from '~/types/meter-readings'
import type { ApiSuccess } from '~/types/api'
import { getApiErrorMessage } from '~/utils/api-error'

export function useContractHandoverReadings(_contractId: string, roomId: string) {
  const isSaving = ref(false)
  const saveError = ref<string | null>(null)

  const { data: readingsData, refresh: refreshReadings } = useFetch<ApiSuccess<MeterReading[]>>(
    '/api/meter-readings',
    { query: { room_id: roomId } },
  )

  const isLoading = ref(false)

  const handoverInReadings = computed(() =>
    (readingsData.value?.data ?? []).filter(r => r.readingType === 'handover_in'),
  )
  const handoverOutReadings = computed(() =>
    (readingsData.value?.data ?? []).filter(r => r.readingType === 'handover_out'),
  )

  function getReadingByType(meterType: 'electricity' | 'water', type: 'handover_in' | 'handover_out'): MeterReading | null {
    const list = type === 'handover_in' ? handoverInReadings.value : handoverOutReadings.value
    return list.find(r => r.meterType === meterType) ?? null
  }

  async function saveReadingForType(
    meterType: 'electricity' | 'water',
    type: 'handover_in' | 'handover_out',
    readingValue: number,
    readingDate: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<void> {
    isSaving.value = true
    saveError.value = null
    try {
      const input: BulkReadingInput = {
        room_id: roomId,
        meter_type: meterType,
        period_year: periodYear,
        period_month: periodMonth,
        reading_type: type,
        reading_date: readingDate,
        reading_value: readingValue,
      }
      await $fetch('/api/meter-readings/bulk', {
        method: 'POST',
        body: { readings: [input] },
      })
      await refreshReadings()
    }
    catch (e: unknown) {
      saveError.value = getApiErrorMessage(e, 'Lưu thất bại')
    }
    finally {
      isSaving.value = false
    }
  }

  return {
    isLoading,
    handoverInReadings,
    handoverOutReadings,
    getReadingByType,
    saveReadingForType,
    isSaving,
    saveError,
  }
}
