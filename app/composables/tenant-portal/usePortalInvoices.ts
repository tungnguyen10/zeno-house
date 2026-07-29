import { usePortalBootstrap } from './usePortalBootstrap'

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
  const { data, status, error, refresh } = usePortalBootstrap()

  const invoices = computed(() => data.value?.data.invoices ?? [])
  const latest = computed(() => {
    const [first, ...rest] = invoices.value
    if (!first) return null

    return rest.reduce((current, candidate) =>
      (isInvoiceNewer(candidate, current) ? candidate : current), first)
  })
  const total = computed(() => data.value?.data.invoiceMeta.total ?? invoices.value.length)

  return { invoices, latest, total, status, error, refresh }
}
