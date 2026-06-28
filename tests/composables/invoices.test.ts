import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

const replaceMock = vi.fn()
const refreshMock = vi.fn()

function installNuxtMocks(initialQuery: Record<string, unknown> = {}) {
  vi.resetModules()
  replaceMock.mockClear()
  refreshMock.mockClear()

  const route = reactive({ query: { ...initialQuery } })
  const fetchState = {
    data: ref(null),
    status: ref('success'),
    error: ref(null),
    refresh: refreshMock,
  }
  const useFetchMock = vi.fn(() => fetchState)

  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
  vi.stubGlobal('useFetch', useFetchMock)
  window.scrollTo = vi.fn()

  return { route, useFetchMock }
}

describe('useInvoiceList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-28T06:00:00.000Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores invoice filters from URL query and sends them to useFetch', async () => {
    const { useFetchMock } = installNuxtMocks({
      building_id: 'building-1',
      period_year: '2026',
      period_month: '5',
      status: ['issued', 'overdue', 'draft'],
      tenant_search: 'Tung',
      page: '3',
    })
    const { useInvoiceList } = await import('../../app/composables/invoices/useInvoiceList')

    const list = useInvoiceList()
    const fetchOptions = useFetchMock.mock.calls[0]?.[1]

    expect(list.buildingId.value).toBe('building-1')
    expect(list.periodYear.value).toBe(2026)
    expect(list.periodMonth.value).toBe(5)
    expect(list.status.value).toEqual(['issued', 'overdue'])
    expect(list.tenantSearchInput.value).toBe('Tung')
    expect(list.page.value).toBe(3)
    expect(fetchOptions.query.value).toMatchObject({
      building_id: 'building-1',
      period_year: 2026,
      period_month: 5,
      status: ['issued', 'overdue'],
      tenant_search: 'Tung',
      page: 3,
      page_size: 50,
    })
  })

  it('resets page and removes page query when filters change', async () => {
    installNuxtMocks({
      period_year: '2026',
      period_month: '6',
      page: '3',
    })
    const { useInvoiceList } = await import('../../app/composables/invoices/useInvoiceList')
    const list = useInvoiceList()

    list.status.value = ['paid']
    await nextTick()

    expect(list.page.value).toBe(1)
    expect(replaceMock).toHaveBeenLastCalledWith({
      query: {
        status: ['paid'],
      },
    })
  })

  it('trims tenant search before syncing URL and API query', async () => {
    const { useFetchMock } = installNuxtMocks({
      period_year: '2026',
      period_month: '6',
    })
    const { useInvoiceList } = await import('../../app/composables/invoices/useInvoiceList')
    const list = useInvoiceList()

    list.tenantSearchInput.value = '  Tung  '
    await nextTick()

    const fetchOptions = useFetchMock.mock.calls[0]?.[1]
    expect(replaceMock).toHaveBeenLastCalledWith({
      query: {
        tenant_search: 'Tung',
      },
    })
    expect(fetchOptions.query.value.tenant_search).toBe('Tung')
  })

  it('omits period_month from URL and API query when all-months is enabled', async () => {
    const { useFetchMock } = installNuxtMocks({
      period_year: '2026',
      period_month: '6',
      page: '2',
    })
    const { useInvoiceList } = await import('../../app/composables/invoices/useInvoiceList')
    const list = useInvoiceList()

    list.allMonths.value = true
    await nextTick()

    const fetchOptions = useFetchMock.mock.calls[0]?.[1]
    expect(replaceMock).toHaveBeenLastCalledWith({
      query: {
        period_year: '2026',
      },
    })
    expect(fetchOptions.query.value.period_month).toBeUndefined()
  })

  it('resetFilters restores current month defaults and clears URL query', async () => {
    installNuxtMocks({
      building_id: 'building-1',
      period_year: '2025',
      period_month: '12',
      status: 'paid',
      tenant_search: 'Tung',
      page: '4',
    })
    const { useInvoiceList } = await import('../../app/composables/invoices/useInvoiceList')
    const list = useInvoiceList()

    list.resetFilters()

    expect(list.buildingId.value).toBe('')
    expect(list.periodYear.value).toBe(2026)
    expect(list.periodMonth.value).toBe(6)
    expect(list.status.value).toEqual([])
    expect(list.tenantSearchInput.value).toBe('')
    expect(list.page.value).toBe(1)
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
  })
})
