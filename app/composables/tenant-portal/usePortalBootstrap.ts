import type { ApiSuccess } from '~/types/api'
import type { TenantPortalBootstrap } from '~/types/tenant-portal'

export function usePortalBootstrap() {
  return useFetch<ApiSuccess<TenantPortalBootstrap>>('/api/tenant/bootstrap', {
    key: 'portal-bootstrap',
    default: () => ({
      data: {
        profile: null,
        contract: null,
        invoices: [],
        invoiceMeta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
    }),
  })
}
