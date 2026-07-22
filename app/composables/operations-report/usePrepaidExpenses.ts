import type { ApiSuccess } from '~/types/api'
import type { PrepaidExpense } from '~/types/operations-report'

interface PrepaidExpensesSource {
  data: Readonly<Ref<PrepaidExpense[]>>
  status: Readonly<Ref<string>>
  refresh: () => Promise<unknown>
}

export function usePrepaidExpenses(
  buildingId: MaybeRef<string | null | undefined>,
  source?: PrepaidExpensesSource,
) {
  const query = computed(() => ({ building_id: toValue(buildingId) ?? '' }))
  const enabled = computed(() => Boolean(toValue(buildingId)))

  const fetched = source ? null : useFetch<ApiSuccess<PrepaidExpense[]>>(
    '/api/prepaid-expenses', { query, immediate: false, watch: false },
  )
  const data = source?.data ?? computed(() => fetched?.data.value?.data ?? [])
  const status = source?.status ?? fetched!.status
  const refresh = source?.refresh ?? fetched!.refresh

  watch(enabled, (ready) => {
    if (ready && !source) refresh()
  }, { immediate: true })

  async function createPrepaidExpense(payload: Record<string, unknown>): Promise<PrepaidExpense> {
    const res = await apiFetch<ApiSuccess<PrepaidExpense>>('/api/prepaid-expenses', {
      method: 'POST',
      body: payload,
    })
    await refresh()
    return res.data
  }

  async function updatePrepaidExpense(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<PrepaidExpense> {
    const res = await apiFetch<ApiSuccess<PrepaidExpense>>(`/api/prepaid-expenses/${id}`, {
      method: 'PATCH',
      body: payload,
    })
    await refresh()
    return res.data
  }

  async function deletePrepaidExpense(id: string): Promise<void> {
    await apiFetch(`/api/prepaid-expenses/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return {
    prepaidExpenses: source?.data ?? computed(() => data.value),
    isLoadingPrepaidExpenses: computed(() => status.value === 'pending'),
    refreshPrepaidExpenses: refresh,
    createPrepaidExpense,
    updatePrepaidExpense,
    deletePrepaidExpense,
  }
}
