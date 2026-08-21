import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const refresh = vi.fn(async () => {})
const useFetchMock = vi.hoisted(() => vi.fn(() => ({
  data: ref({ data: [], meta: { periodYear: 2026, periodMonth: 7 } }),
  status: ref('success'),
  error: ref(null),
  refresh,
})))

vi.stubGlobal('useFetch', useFetchMock)

describe('useSharedExpenses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes reactive period refs to the list request', async () => {
    const periodYear = ref(2026)
    const periodMonth = ref(7)
    const { useSharedExpenses } = await import('../../app/composables/useSharedExpenses')

    useSharedExpenses(periodYear, periodMonth)

    expect(useFetchMock).toHaveBeenCalledWith('/api/shared-expenses', {
      query: { period_year: periodYear, period_month: periodMonth },
    })
  })
})
