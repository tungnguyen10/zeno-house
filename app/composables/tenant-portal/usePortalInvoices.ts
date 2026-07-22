import { usePortalBootstrap } from './usePortalBootstrap'

/** Invoices list for the signed-in tenant (newest first from the server). */
export function usePortalInvoices() {
  const { data, status, error, refresh } = usePortalBootstrap()

  const invoices = computed(() => data.value?.data.invoices ?? [])
  const latest = computed(() => invoices.value[0] ?? null)
  const total = computed(() => data.value?.data.invoiceMeta.total ?? invoices.value.length)

  return { invoices, latest, total, status, error, refresh }
}
