import type { ApiSuccess } from '~/types/api'
import type { AccessRequest, AccessRequestStatus } from '~/types/access-requests'
import type { AccessRequestApprovalInput, AccessRequestRejectionInput } from '~/utils/validators/access-requests'

export function useAccessRequests() {
  const selectedStatus = ref<AccessRequestStatus>('pending')
  const query = computed(() => ({ status: selectedStatus.value }))
  const { data, status, error, refresh } = useFetch<ApiSuccess<AccessRequest[]>>('/api/access-requests', { query })

  const requests = computed(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function approve(id: string, input: AccessRequestApprovalInput): Promise<void> {
    await apiFetch(`/api/access-requests/${id}/approve`, { method: 'POST', body: input })
    await refresh()
  }

  async function reject(id: string, input: AccessRequestRejectionInput): Promise<void> {
    await apiFetch(`/api/access-requests/${id}/reject`, { method: 'POST', body: input })
    await refresh()
  }

  return { selectedStatus, requests, isLoading, error, refresh, approve, reject }
}
