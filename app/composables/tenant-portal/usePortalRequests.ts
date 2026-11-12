import type { ApiSuccess } from '~/types/api'
import type { TenantSupportRequest } from '~/types/tenant-portal'
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
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantSupportRequest[]>>(
    '/api/tenant/requests',
    { key: 'portal-requests', default: () => ({ data: [] }) },
  )

  const requests = computed(() => data.value?.data ?? [])
  const submitting = ref(false)
  const apiError = ref<string | null>(null)

  async function submit(input: TenantSupportRequestCreateInput): Promise<boolean> {
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
    try {
      if (input.attachment) {
        const form = new FormData()
        form.append('title', parsed.data.title)
        form.append('description', parsed.data.description)
        form.append('attachment', input.attachment, input.attachment.name)
        await uploadWithProgress<ApiSuccess<TenantSupportRequest>>(
          '/api/tenant/requests',
          form,
        )
      }
      else {
        await apiFetch<ApiSuccess<TenantSupportRequest>>('/api/tenant/requests', {
          method: 'POST',
          body: { title: parsed.data.title, description: parsed.data.description },
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
