import type { OperatorTenantSupportRequest, TenantSupportRequestQueuePage } from '~/types/tenant-support-requests'
import type { TenantSupportRequestStatus } from '~/types/tenant-portal'
import type { ApiSuccess } from '~/types/api'
import { getApiErrorCode, getApiErrorMessage } from '~/utils/api-error'

export function useTenantSupportRequestQueue() {
  const selectedStatus = ref('')
  const page = ref(1)
  const query = computed(() => ({ page: page.value, limit: 20, status: selectedStatus.value || undefined }))
  const { data, status, error, refresh } = useFetch<TenantSupportRequestQueuePage>('/api/tenant-support-requests', { query })
  const requests = computed(() => data.value?.data ?? [])
  const meta = computed(() => data.value?.meta ?? { total: 0, page: page.value, limit: 20, totalPages: 0 })
  const updating = ref(false)
  const actionError = ref<string | null>(null)
  watch(selectedStatus, () => { page.value = 1 })

  async function updateStatus(request: OperatorTenantSupportRequest, target: Exclude<TenantSupportRequestStatus, 'new'>) {
    if (updating.value) return null
    updating.value = true
    actionError.value = null
    try {
      const result = await apiFetch<ApiSuccess<OperatorTenantSupportRequest>>(`/api/tenant-support-requests/${request.id}`, {
        method: 'PATCH', body: { status: target, expected_status: request.status },
      })
      await refresh()
      return result.data
    }
    catch (error) {
      actionError.value = getApiErrorCode(error) === 'CONFLICT'
        ? 'Yêu cầu đã được cập nhật. Tải lại danh sách rồi mở lại yêu cầu trước khi xử lý.'
        : getApiErrorMessage(error, 'Không thể cập nhật trạng thái. Vui lòng thử lại.')
      return null
    }
    finally { updating.value = false }
  }

  return { selectedStatus, page, requests, meta, status, error, refresh, updating, actionError, updateStatus }
}
