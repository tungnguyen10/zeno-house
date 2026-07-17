import type { ApiSuccess } from '~/types/api'
import { getApiErrorMessage } from '~/utils/api-error'

/**
 * Tenant support requests. Consumes `/api/tenant/requests`, which is delivered
 * by the separate `add-tenant-support-requests` change. Until that endpoint
 * ships, `useFetch` surfaces the error and the page renders its error state —
 * no placeholder data is fabricated.
 */
export type TenantRequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface TenantSupportRequest {
  id: string
  title: string
  category: string
  status: TenantRequestStatus
  description: string
  createdAt: string
  attachmentSignedUrl: string | null
}

export interface TenantSupportRequestCreateInput {
  title: string
  category: string
  description: string
}

export function usePortalRequests() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantSupportRequest[]>>(
    '/api/tenant/requests',
    { key: 'portal-requests', default: () => ({ data: [] }) },
  )

  const requests = computed(() => data.value?.data ?? [])
  const submitting = ref(false)
  const apiError = ref<string | null>(null)

  async function submit(input: TenantSupportRequestCreateInput): Promise<boolean> {
    apiError.value = null
    submitting.value = true
    try {
      await apiFetch<ApiSuccess<TenantSupportRequest>>('/api/tenant/requests', {
        method: 'POST',
        body: input,
      })
      await refresh()
      return true
    }
    catch (e: unknown) {
      apiError.value = getApiErrorMessage(e)
      return false
    }
    finally {
      submitting.value = false
    }
  }

  return { requests, status, error, refresh, submit, submitting, apiError }
}
