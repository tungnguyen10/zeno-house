import { getCurrentInstance } from 'vue'
import type { ApiSuccess } from '~/types/api'
import type { TenantSupportRequest } from '~/types/tenant-portal'
import type { TenantSupportRequestPage } from '~/types/tenant-support-requests'
import { getApiErrorMessage } from '~/utils/api-error'
import { uploadWithProgress } from '~/utils/upload'
import { tenantSupportRequestCreateSchema } from '~/utils/validators/tenant-portal'

/** Private support requests and single-file evidence; never mutates canonical profile/images. */
export interface TenantSupportRequestCreateInput {
  title: string
  description: string
  attachment?: File
}

export function usePortalRequests() {
  const sessionKey = usePortalSessionKey('requests')
  const { data, status, error, refresh: refreshPage } = useFetch<TenantSupportRequestPage>(
    '/api/tenant/requests',
    { key: sessionKey, query: { page: 1, limit: 20 }, default: () => ({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }) },
  )

  const appended = ref<TenantSupportRequest[]>([])
  const loadedPage = ref(1)
  const loadingMore = ref(false)
  const loadMoreError = ref<string | null>(null)
  let listVersion = 0
  const requests = computed(() => [...new Map([...(data.value?.data ?? []), ...appended.value].map(request => [request.id, request])).values()])
  const hasMore = computed(() => loadedPage.value < (data.value?.meta?.totalPages ?? 0))
  const submitting = ref(false)
  const progress = ref(0)
  const apiError = ref<string | null>(null)
  const submitController = shallowRef<AbortController | null>(null)

  function resetPages() {
    listVersion++
    appended.value = []
    loadedPage.value = 1
    loadingMore.value = false
    loadMoreError.value = null
  }
  watch(sessionKey, () => {
    resetPages()
    submitController.value?.abort()
    submitController.value = null
    submitting.value = false
    progress.value = 0
    apiError.value = null
  }, { flush: 'sync' })
  if (getCurrentInstance()) onBeforeUnmount(() => submitController.value?.abort())

  async function refresh() {
    resetPages()
    await refreshPage()
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value) return
    const version = listVersion
    const key = sessionKey.value
    const nextPage = loadedPage.value + 1
    loadingMore.value = true
    loadMoreError.value = null
    try {
      const response = await apiFetch<TenantSupportRequestPage>('/api/tenant/requests', { query: { page: nextPage, limit: 20 } })
      if (version !== listVersion || key !== sessionKey.value) return
      appended.value.push(...response.data)
      loadedPage.value = nextPage
    }
    catch (error) {
      if (version === listVersion && key === sessionKey.value) loadMoreError.value = getApiErrorMessage(error, 'Không tải được yêu cầu cũ. Hãy thử lại.')
    }
    finally {
      if (version === listVersion && key === sessionKey.value) loadingMore.value = false
    }
  }

  async function loadDetail(id: string): Promise<TenantSupportRequest | null> {
    const key = sessionKey.value
    const response = await apiFetch<ApiSuccess<TenantSupportRequest>>(`/api/tenant/requests/${encodeURIComponent(id)}`)
    if (key !== sessionKey.value) return null
    return response.data
  }

  async function submit(input: TenantSupportRequestCreateInput): Promise<boolean> {
    if (submitting.value) return false
    apiError.value = null
    const parsed = tenantSupportRequestCreateSchema.safeParse({
      title: input.title,
      description: input.description,
      attachment: input.attachment
        ? { name: input.attachment.name, mimeType: input.attachment.type, size: input.attachment.size }
        : undefined,
    })
    if (!parsed.success) {
      apiError.value = 'Yêu cầu chưa hợp lệ. Kiểm tra tiêu đề, mô tả và tệp đính kèm (JPEG, PNG, WebP hoặc PDF, tối đa 5MB).'
      return false
    }
    submitting.value = true
    progress.value = 0
    const key = sessionKey.value
    const controller = new AbortController()
    submitController.value = controller
    try {
      if (input.attachment) {
        const form = new FormData()
        form.append('title', parsed.data.title)
        form.append('description', parsed.data.description)
        form.append('attachment', input.attachment, input.attachment.name)
        await uploadWithProgress<ApiSuccess<TenantSupportRequest>>(
          '/api/tenant/requests',
          form,
          {
            // Creating a request is not idempotent: never retry its POST silently.
            retries: 0,
            signal: controller.signal,
            onProgress: (percent) => {
              if (submitController.value === controller && !controller.signal.aborted && key === sessionKey.value) progress.value = percent
            },
          },
        )
      }
      else {
        await apiFetch<ApiSuccess<TenantSupportRequest>>('/api/tenant/requests', {
          method: 'POST',
          body: { title: parsed.data.title, description: parsed.data.description },
          signal: controller.signal,
        })
      }
      if (key !== sessionKey.value || controller.signal.aborted) return false
      await refresh()
      return key === sessionKey.value && !controller.signal.aborted
    }
    catch (e: unknown) {
      if (key === sessionKey.value && !controller.signal.aborted) apiError.value = getApiErrorMessage(e)
      return false
    }
    finally {
      if (submitController.value === controller) {
        submitting.value = false
        submitController.value = null
      }
    }
  }

  return { sessionKey, requests, status, error, refresh, loadMore, hasMore, loadingMore, loadMoreError, loadDetail, submit, submitting, progress, apiError }
}
