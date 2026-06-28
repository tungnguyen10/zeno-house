import type { ApiSuccess } from '~/types/api'
import type { InvoiceStatus } from '~/utils/constants/billing'
import type { InvoiceListItem, InvoiceListMeta } from '~/utils/validators/invoices'

const LIST_STATUSES: InvoiceStatus[] = ['issued', 'partial', 'paid', 'overdue', 'void']

function currentDateInHoChiMinh(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  return {
    year: Number(parts.find(part => part.type === 'year')?.value ?? new Date().getFullYear()),
    month: Number(parts.find(part => part.type === 'month')?.value ?? new Date().getMonth() + 1),
  }
}

function readNumber(raw: unknown): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readString(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

function readStatuses(raw: unknown): InvoiceStatus[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  return arr
    .map(value => String(value))
    .filter((value): value is InvoiceStatus => LIST_STATUSES.includes(value as InvoiceStatus))
}

export function useInvoiceList() {
  const route = useRoute()
  const router = useRouter()
  const today = currentDateInHoChiMinh()

  const buildingId = ref(readString(route.query.building_id))
  const periodYear = ref(readNumber(route.query.period_year) ?? today.year)
  const periodMonth = ref<number | undefined>(readNumber(route.query.period_month) ?? today.month)
  const allMonths = ref(route.query.period_month === undefined ? false : periodMonth.value === undefined)
  const status = ref<InvoiceStatus[]>(readStatuses(route.query.status))
  const tenantSearchInput = ref(readString(route.query.tenant_search))
  const tenantSearch = ref(tenantSearchInput.value)
  const page = ref(readNumber(route.query.page) ?? 1)
  const pageSize = ref(50)
  let syncingFromRoute = false

  const apiQuery = computed(() => ({
    building_id: buildingId.value || undefined,
    period_year: periodYear.value,
    period_month: allMonths.value ? undefined : periodMonth.value,
    status: status.value.length > 0 ? status.value : undefined,
    tenant_search: tenantSearch.value || undefined,
    page: page.value,
    page_size: pageSize.value,
  }))

  function cleanQuery(): Record<string, string | string[]> {
    const next: Record<string, string | string[]> = {}
    if (buildingId.value) next.building_id = buildingId.value
    if (periodYear.value && (periodYear.value !== today.year || allMonths.value)) {
      next.period_year = String(periodYear.value)
    }
    if (!allMonths.value && periodMonth.value && (
      periodYear.value !== today.year
      || periodMonth.value !== today.month
    )) {
      next.period_month = String(periodMonth.value)
    }
    if (status.value.length > 0) next.status = status.value
    if (tenantSearch.value) next.tenant_search = tenantSearch.value
    if (page.value > 1) next.page = String(page.value)
    return next
  }

  function replaceRoute(resetPage = false) {
    if (syncingFromRoute) return
    if (resetPage) page.value = 1
    router.replace({ query: cleanQuery() })
    if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  watch([buildingId, periodYear, periodMonth, allMonths, status], () => {
    replaceRoute(true)
  }, { deep: true })

  watch(page, () => replaceRoute(false))

  watch(tenantSearchInput, (value) => {
    if (syncingFromRoute) return
    tenantSearch.value = value.trim()
    replaceRoute(true)
  })

  watch(() => route.query, (query) => {
    syncingFromRoute = true
    buildingId.value = readString(query.building_id)
    periodYear.value = readNumber(query.period_year) ?? today.year
    periodMonth.value = readNumber(query.period_month)
    allMonths.value = query.period_month === undefined ? false : periodMonth.value === undefined
    if (!allMonths.value && periodMonth.value === undefined) periodMonth.value = today.month
    status.value = readStatuses(query.status)
    tenantSearchInput.value = readString(query.tenant_search)
    tenantSearch.value = tenantSearchInput.value
    page.value = readNumber(query.page) ?? 1
    nextTick(() => {
      syncingFromRoute = false
    })
  })

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<InvoiceListItem[]> & { meta: InvoiceListMeta }
  >('/api/invoices', {
    query: apiQuery,
    watch: [apiQuery],
  })

  const invoices = computed(() => data.value?.data ?? [])
  const meta = computed<InvoiceListMeta>(() =>
    data.value?.meta ?? {
      page: page.value,
      page_size: pageSize.value,
      total: 0,
      total_pages: 1,
    },
  )
  const isLoading = computed(() => fetchStatus.value === 'pending')
  const isInitialLoading = computed(() => isLoading.value && !data.value)
  const errorMessage = computed(() => {
    const err = error.value as { data?: { error?: { message?: string } }; message?: string } | null
    return err?.data?.error?.message ?? err?.message ?? null
  })
  const errorCode = computed(() => {
    const err = error.value as { data?: { error?: { code?: string } } } | null
    return err?.data?.error?.code ?? null
  })

  function nextPage() {
    if (page.value < meta.value.total_pages) page.value++
  }

  function previousPage() {
    if (page.value > 1) page.value--
  }

  const hasActiveFilters = computed(() =>
    Boolean(buildingId.value)
    || periodYear.value !== today.year
    || periodMonth.value !== today.month
    || allMonths.value
    || status.value.length > 0
    || Boolean(tenantSearchInput.value),
  )

  function resetFilters() {
    buildingId.value = ''
    periodYear.value = today.year
    periodMonth.value = today.month
    allMonths.value = false
    status.value = []
    tenantSearchInput.value = ''
    tenantSearch.value = ''
    page.value = 1
    replaceRoute(false)
  }

  return {
    buildingId,
    periodYear,
    periodMonth,
    allMonths,
    status,
    tenantSearchInput,
    page,
    pageSize,
    invoices,
    meta,
    isLoading,
    isInitialLoading,
    errorMessage,
    errorCode,
    hasActiveFilters,
    refresh,
    nextPage,
    previousPage,
    resetFilters,
  }
}
