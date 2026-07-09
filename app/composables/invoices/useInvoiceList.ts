import type { ApiSuccess } from '~/types/api'
import type { InvoiceStatus } from '~/utils/constants/billing'
import type { InvoiceListItem, InvoiceListMeta } from '~/utils/validators/invoices'
import { useRouteListQuerySync, readQueryEnumArray, readQueryString } from '~/composables/useRouteListQuerySync'
import { getApiErrorCode, getApiErrorMessage } from '~/utils/api-error'

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

export function useInvoiceList() {
  const route = useRoute()
  const today = currentDateInHoChiMinh()

  const buildingId = ref(readQueryString(route.query.building_id))
  const periodYear = ref(readNumber(route.query.period_year) ?? today.year)
  const periodMonth = ref<number | undefined>(readNumber(route.query.period_month) ?? today.month)
  const allMonths = ref(route.query.period_month === undefined ? false : periodMonth.value === undefined)
  const status = ref<InvoiceStatus[]>(readQueryEnumArray(route.query.status, LIST_STATUSES))
  const tenantSearchInput = ref(readQueryString(route.query.tenant_search))
  const page = ref(readNumber(route.query.page) ?? 1)
  const pageSize = ref(50)
  const tenantSearch = computed(() => tenantSearchInput.value.trim())

  const apiQuery = computed(() => ({
    building_id: buildingId.value || undefined,
    period_year: periodYear.value,
    period_month: allMonths.value ? undefined : periodMonth.value,
    status: status.value.length > 0 ? status.value : undefined,
    tenant_search: tenantSearch.value || undefined,
    page: page.value,
    page_size: pageSize.value,
  }))

  const { replaceRoute } = useRouteListQuerySync({
    page,
    resetPageOn: [buildingId, periodYear, periodMonth, allMonths, status, tenantSearchInput],
    syncOn: [page],
    parseRoute(query) {
      buildingId.value = readQueryString(query.building_id)
      periodYear.value = readNumber(query.period_year) ?? today.year
      periodMonth.value = readNumber(query.period_month)
      allMonths.value = query.period_month === undefined ? false : periodMonth.value === undefined
      if (!allMonths.value && periodMonth.value === undefined) periodMonth.value = today.month
      status.value = readQueryEnumArray(query.status, LIST_STATUSES)
      tenantSearchInput.value = readQueryString(query.tenant_search)
      page.value = readNumber(query.page) ?? 1
    },
    buildQuery() {
      const next: Record<string, string | string[] | undefined> = {}
      next.building_id = buildingId.value || undefined
      next.period_year = periodYear.value && (periodYear.value !== today.year || allMonths.value)
        ? String(periodYear.value)
        : undefined
      next.period_month = !allMonths.value && periodMonth.value && (
        periodYear.value !== today.year || periodMonth.value !== today.month
      )
        ? String(periodMonth.value)
        : undefined
      next.status = status.value.length > 0 ? status.value : undefined
      next.tenant_search = tenantSearch.value || undefined
      next.page = page.value > 1 ? String(page.value) : undefined
      return next
    },
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
  const errorMessage = computed(() => getApiErrorMessage(error.value, '') || null)
  const errorCode = computed(() => getApiErrorCode(error.value) ?? null)

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
    page.value = 1
    replaceRoute()
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
