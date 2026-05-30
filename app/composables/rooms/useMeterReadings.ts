import type { MeterReading } from '~/types/meter-readings'
import type { ApiSuccess } from '~/types/api'
import type { MeterReadingCreateInput } from '~/utils/validators/meter-readings'

export function useMeterReadings(roomId: string) {
  const { data, refresh, pending, error } = useFetch<ApiSuccess<MeterReading[]>>(
    '/api/meter-readings',
    { query: { room_id: roomId } },
  )

  const readings = computed(() => data.value?.data ?? [])

  async function createReading(input: MeterReadingCreateInput) {
    await $fetch('/api/meter-readings', {
      method: 'POST',
      body: input,
    })
    await refresh()
  }

  return { readings, isLoading: pending, error, createReading, refresh }
}
