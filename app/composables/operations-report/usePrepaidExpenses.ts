import type { ApiSuccess } from '~/types/api'
import type { PrepaidExpense } from '~/types/operations-report'

export function usePrepaidExpenses(buildingId: MaybeRef<string | null | undefined>) {
  const query = computed(() => ({ building_id: toValue(buildingId) ?? '' }))
  const enabled = computed(() => Boolean(toValue(buildingId)))

  const { data, status, refresh } = useFetch<ApiSuccess<PrepaidExpense[]>>(
    '/api/prepaid-expenses',
    { query, immediate: false, watch: false },
  )

  watch(enabled, (ready) => {
    if (ready) refresh()
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
    prepaidExpenses: computed(() => data.value?.data ?? []),
    isLoadingPrepaidExpenses: computed(() => status.value === 'pending'),
    refreshPrepaidExpenses: refresh,
    createPrepaidExpense,
    updatePrepaidExpense,
    deletePrepaidExpense,
  }
}
