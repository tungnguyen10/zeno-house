import type { ApiSuccess } from '~/types/api'
import type { SharedExpense, SharedExpenseAllocationResult } from '~/types/shared-expenses'

export function useSharedExpenses() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<SharedExpense[]>>(
    '/api/shared-expenses',
  )

  async function create(payload: Record<string, unknown>) {
    const res = await apiFetch<ApiSuccess<SharedExpense>>('/api/shared-expenses', {
      method: 'POST',
      body: payload,
    })
    await refresh()
    return res.data
  }

  async function update(id: string, payload: Record<string, unknown>) {
    const res = await apiFetch<ApiSuccess<SharedExpense>>(`/api/shared-expenses/${id}`, {
      method: 'PATCH',
      body: payload,
    })
    await refresh()
    return res.data
  }

  async function remove(id: string) {
    await apiFetch<ApiSuccess<{ id: string }>>(`/api/shared-expenses/${id}`, {
      method: 'DELETE',
    })
    await refresh()
  }

  async function allocate(id: string, payload: { period_year: number, period_month: number }) {
    const res = await apiFetch<ApiSuccess<SharedExpenseAllocationResult>>(
      `/api/shared-expenses/${id}/allocate`,
      { method: 'POST', body: payload },
    )
    return res.data
  }

  return {
    sharedExpenses: computed(() => data.value?.data ?? []),
    sharedExpensesLoading: computed(() => status.value === 'pending'),
    sharedExpensesError: error,
    refreshSharedExpenses: refresh,
    createSharedExpense: create,
    updateSharedExpense: update,
    removeSharedExpense: remove,
    allocateSharedExpense: allocate,
  }
}
