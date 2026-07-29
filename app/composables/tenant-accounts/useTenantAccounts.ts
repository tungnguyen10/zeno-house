import type { ApiSuccess } from '~/types/api'
import type {
  TenantAccountCredentials,
  TenantAccountListItem,
  TenantAccountOrphan,
  TenantAccountRemovalResult,
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
  const orphans = ref<TenantAccountOrphan[]>([])
  const orphansLoading = ref(false)
  const orphansError = ref<unknown>(null)

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

  async function revoke(tenantId: string): Promise<TenantAccountRemovalResult> {
    const res = await apiFetch<ApiSuccess<TenantAccountRemovalResult>>(
      `/api/tenants/${tenantId}/account`,
      { method: 'DELETE' },
    )
    await refresh()
    return res.data
  }

  async function loadOrphans(): Promise<void> {
    orphansLoading.value = true
    orphansError.value = null
    try {
      const res = await apiFetch<ApiSuccess<TenantAccountOrphan[]>>('/api/tenant-accounts/orphans')
      orphans.value = res.data
    }
    catch (error) {
      orphansError.value = error
    }
    finally {
      orphansLoading.value = false
    }
  }

  async function reconcileOrphan(authUserId: string): Promise<TenantAccountRemovalResult> {
    const res = await apiFetch<ApiSuccess<TenantAccountRemovalResult>>(
      `/api/tenant-accounts/orphans/${authUserId}`,
      { method: 'DELETE' },
    )
    await loadOrphans()
    return res.data
  }

  return {
    accounts,
    status,
    error,
    refresh,
    orphans,
    orphansLoading,
    orphansError,
    loadOrphans,
    provision,
    setStatus,
    resetPassword,
    revoke,
    reconcileOrphan,
  }
}
