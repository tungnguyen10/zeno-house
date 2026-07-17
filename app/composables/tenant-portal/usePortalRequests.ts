import type { ApiSuccess } from '~/types/api'
import type { TenantSupportRequest } from '~/types/tenant-portal'
import { getApiErrorMessage } from '~/utils/api-error'
import { uploadWithProgress } from '~/utils/upload'

/**
 * Tenant support requests. Consumes `/api/tenant/requests`, which is delivered
 * by the separate `add-tenant-support-requests` change. Until that endpoint
 * ships, `useFetch` surfaces the error and the page renders its error state —
 * no placeholder data is fabricated.
 */
export interface TenantSupportRequestCreateInput {
  title: string
  description: string
  attachment?: File
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
      if (input.attachment) {
        const form = new FormData()
        form.append('title', input.title)
        form.append('description', input.description)
        form.append('attachment', input.attachment, input.attachment.name)
        await uploadWithProgress<ApiSuccess<TenantSupportRequest>>(
          '/api/tenant/requests',
          form,
        )
      }
      else {
        await apiFetch<ApiSuccess<TenantSupportRequest>>('/api/tenant/requests', {
          method: 'POST',
          body: { title: input.title, description: input.description },
        })
      }
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
