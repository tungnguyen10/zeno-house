import type { ApiSuccess } from '~/types/api'
import type {
  TenantAccountCredentials,
  TenantAccountListItem,
  TenantAccountStatus,
} from '~/types/tenant-accounts'
import type { TenantAccountProvisionInput } from '~/utils/validators/tenant-accounts'

/**
 * Operator-facing tenant portal account provisioning (admin/owner). Lists
 * provisioned accounts and drives provision/status/reset/revoke against the
 * dedicated `/api/tenants/[id]/account` endpoints.
 */
export function useTenantAccounts() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantAccountListItem[]>>(
    '/api/tenant-accounts',
    { key: 'tenant-accounts', default: () => ({ data: [] }) },
  )

  const accounts = computed(() => data.value?.data ?? [])

  async function provision(
    tenantId: string,
    input: TenantAccountProvisionInput,
  ): Promise<TenantAccountCredentials> {
    const res = await apiFetch<ApiSuccess<TenantAccountCredentials>>(
      `/api/tenants/${tenantId}/account`,
      { method: 'POST', body: input },
    )
    await refresh()
    return res.data
  }

  async function setStatus(tenantId: string, next: TenantAccountStatus): Promise<void> {
    await apiFetch(`/api/tenants/${tenantId}/account`, { method: 'PATCH', body: { status: next } })
    await refresh()
  }

  async function resetPassword(tenantId: string): Promise<TenantAccountCredentials> {
    const res = await apiFetch<ApiSuccess<TenantAccountCredentials>>(
      `/api/tenants/${tenantId}/account/reset-password`,
      { method: 'POST' },
    )
    return res.data
  }

  async function revoke(tenantId: string): Promise<void> {
    await apiFetch(`/api/tenants/${tenantId}/account`, { method: 'DELETE' })
    await refresh()
  }

  return { accounts, status, error, refresh, provision, setStatus, resetPassword, revoke }
}
