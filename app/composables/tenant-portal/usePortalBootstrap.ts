import type { ApiSuccess } from '~/types/api'
import type { TenantPortalBootstrap } from '~/types/tenant-portal'

export function usePortalBootstrap() {
  return useFetch<ApiSuccess<TenantPortalBootstrap>>('/api/tenant/bootstrap', {
    key: usePortalSessionKey('bootstrap'),
    default: () => ({
      data: {
        profile: null,
        contract: null,
        contractAmendments: [],
        invoices: [],
        financialSummary: { outstandingAmount: 0, outstandingCount: 0, overdueAmount: 0, overdueCount: 0, nextInvoice: null },
        invoiceMeta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
    }),
  })
}
