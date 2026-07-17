import type { ApiSuccess } from '~/types/api'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'

interface InvoiceListMeta extends Record<string, unknown> {
  total: number
  page: number
  limit: number
  totalPages: number
}

/** Invoices list for the signed-in tenant (newest first from the server). */
export function usePortalInvoices() {
  const { data, status, error, refresh } = useFetch<
    ApiSuccess<TenantInvoiceListItem[], InvoiceListMeta>
  >('/api/tenant/invoices', {
    key: 'portal-invoices',
    default: () => ({ data: [] }),
  })

  const invoices = computed(() => data.value?.data ?? [])
  const latest = computed(() => invoices.value[0] ?? null)
  const total = computed(() => data.value?.meta?.total ?? invoices.value.length)

  return { invoices, latest, total, status, error, refresh }
}
