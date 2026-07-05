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

  async function deposit(payload: { amount: number, date: string, note?: string | null }) {
    if (!buildingId.value) throw new Error('No building id')
    const res = await $fetch<ApiSuccess<ReserveFund>>(`/api/reserve-funds/${buildingId.value}/deposit`, {
      method: 'POST',
      body: payload,
    })
    await refresh()
    return res.data
  }

  async function withdraw(payload: { amount: number, date: string, note?: string | null }) {
    if (!buildingId.value) throw new Error('No building id')
    const res = await $fetch<ApiSuccess<ReserveFund>>(`/api/reserve-funds/${buildingId.value}/withdraw`, {
      method: 'POST',
      body: payload,
    })
    await refresh()
    return res.data
  }

  return {
    reserveFund: computed(() => data.value?.data ?? null),
    reserveFundLoading: computed(() => status.value === 'pending'),
    reserveFundError: error,
    refreshReserveFund: refresh,
    depositReserveFund: deposit,
    withdrawReserveFund: withdraw,
  }
}
