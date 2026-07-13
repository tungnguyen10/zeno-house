import type { ApiSuccess } from '~/types/api'
import type {
  RecurringExpense,
  RecurringExpenseRecordPrefill,
} from '~/types/operations-report'

export function useRecurringExpenses(buildingId: MaybeRef<string | null | undefined>) {
  const query = computed(() => ({ building_id: toValue(buildingId) ?? '' }))
  const enabled = computed(() => Boolean(toValue(buildingId)))

  const { data, status, refresh } = useFetch<ApiSuccess<RecurringExpense[]>>(
    '/api/recurring-expenses',
    { query, immediate: false, watch: false },
  )
  const { data: upcomingData, refresh: refreshUpcoming } = useFetch<ApiSuccess<RecurringExpense[]>>(
    '/api/recurring-expenses',
    {
      query: computed(() => ({ ...query.value, upcoming: 'true' })),
      immediate: false,
      watch: false,
    },
  )

  watch(enabled, (ready) => {
    if (ready) {
      refresh()
      refreshUpcoming()
    }
  }, { immediate: true })

  async function createRecurringExpense(payload: Record<string, unknown>): Promise<RecurringExpense> {
    const res = await apiFetch<ApiSuccess<RecurringExpense>>('/api/recurring-expenses', {
      method: 'POST',
      body: payload,
    })
    await Promise.all([refresh(), refreshUpcoming()])
    return res.data
  }

  async function updateRecurringExpense(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<RecurringExpense> {
    const res = await apiFetch<ApiSuccess<RecurringExpense>>(`/api/recurring-expenses/${id}`, {
      method: 'PATCH',
      body: payload,
    })
    await Promise.all([refresh(), refreshUpcoming()])
    return res.data
  }

  async function deleteRecurringExpense(id: string): Promise<void> {
    await apiFetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' })
    await Promise.all([refresh(), refreshUpcoming()])
  }

  async function recordRecurringExpense(
    id: string,
    payload: Record<string, unknown> = {},
  ): Promise<{ recurringExpense: RecurringExpense, prefill: RecurringExpenseRecordPrefill }> {
    const res = await apiFetch<ApiSuccess<{
      recurringExpense: RecurringExpense
      prefill: RecurringExpenseRecordPrefill
    }>>(`/api/recurring-expenses/${id}/record`, {
      method: 'POST',
      body: payload,
    })
    await Promise.all([refresh(), refreshUpcoming()])
    return res.data
  }

  async function dismissRecurringExpense(id: string): Promise<RecurringExpense> {
    const res = await apiFetch<ApiSuccess<RecurringExpense>>(`/api/recurring-expenses/${id}/dismiss`, {
      method: 'POST',
    })
    await Promise.all([refresh(), refreshUpcoming()])
    return res.data
  }

  return {
    recurringExpenses: computed(() => data.value?.data ?? []),
    upcomingRecurringExpenses: computed(() => upcomingData.value?.data ?? []),
    isLoadingRecurringExpenses: computed(() => status.value === 'pending'),
    refreshRecurringExpenses: refresh,
    refreshUpcomingRecurringExpenses: refreshUpcoming,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    recordRecurringExpense,
    dismissRecurringExpense,
  }
}
