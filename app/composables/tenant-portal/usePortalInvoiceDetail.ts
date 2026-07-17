import type { ApiSuccess } from '~/types/api'
import type { TenantInvoiceDetail } from '~/types/tenant-portal'

/** Single invoice detail (with charge breakdown) for the signed-in tenant. */
export function usePortalInvoiceDetail(id: MaybeRefOrGetter<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantInvoiceDetail>>(
    () => `/api/tenant/invoices/${toValue(id)}`,
    { key: () => `portal-invoice-${toValue(id)}`, watch: [() => toValue(id)] },
  )

  const invoice = computed(() => data.value?.data ?? null)

  return { invoice, status, error, refresh }
}
