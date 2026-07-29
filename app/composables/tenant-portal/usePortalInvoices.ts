import { usePortalBootstrap } from './usePortalBootstrap'
import type { ApiSuccess } from '~/types/api'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import { getApiErrorMessage } from '~/utils/api-error'

type InvoicePageMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
}

function isInvoiceNewer(
  candidate: { periodYear: number; periodMonth: number; issuedAt: string | null; invoiceCode: string },
  current: { periodYear: number; periodMonth: number; issuedAt: string | null; invoiceCode: string },
): boolean {
  if (candidate.periodYear !== current.periodYear) {
    return candidate.periodYear > current.periodYear
  }
  if (candidate.periodMonth !== current.periodMonth) {
    return candidate.periodMonth > current.periodMonth
  }

  const candidateIssuedAt = candidate.issuedAt ?? ''
  const currentIssuedAt = current.issuedAt ?? ''
  if (candidateIssuedAt !== currentIssuedAt) {
    return candidateIssuedAt > currentIssuedAt
  }

  return candidate.invoiceCode > current.invoiceCode
}

export function usePortalInvoices() {
  const { data, status, error, refresh: refreshBootstrap } = usePortalBootstrap()
  const extraInvoices = ref<TenantInvoiceListItem[]>([])
  const currentPage = ref(1)
  const loadingMore = ref(false)
  const loadMoreError = ref<string | null>(null)

  const invoices = computed(() => [
    ...(data.value?.data.invoices ?? []),
    ...extraInvoices.value,
  ])
  const latest = computed(() => {
    const [first, ...rest] = invoices.value
    if (!first) return null

    return rest.reduce((current, candidate) =>
      (isInvoiceNewer(candidate, current) ? candidate : current), first)
  })
  const total = computed(() => data.value?.data.invoiceMeta.total ?? invoices.value.length)
  const totalPages = computed(() => data.value?.data.invoiceMeta.totalPages ?? 1)
  const hasMore = computed(() => currentPage.value < totalPages.value)

  async function refresh() {
    extraInvoices.value = []
    currentPage.value = 1
    loadMoreError.value = null
    await refreshBootstrap()
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
    loadMoreError.value = null
    const nextPage = currentPage.value + 1
    try {
      const response = await apiFetch<ApiSuccess<TenantInvoiceListItem[], InvoicePageMeta>>(
        '/api/tenant/invoices',
        { query: { page: nextPage, page_size: data.value?.data.invoiceMeta.limit ?? 20 } },
      )
      const known = new Set(invoices.value.map(invoice => invoice.id))
      extraInvoices.value.push(...response.data.filter(invoice => !known.has(invoice.id)))
      currentPage.value = response.meta?.page ?? nextPage
    }
    catch (error) {
      loadMoreError.value = getApiErrorMessage(error, 'Không thể tải thêm hóa đơn.')
    }
    finally {
      loadingMore.value = false
    }
  }

  return {
    invoices,
    latest,
    total,
    status,
    error,
    refresh,
    hasMore,
    loadMore,
    loadingMore,
    loadMoreError,
  }
}
