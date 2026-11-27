import type { ApiSuccess } from '~/types/api'
import type { TenantContractDocument } from '~/types/tenant-contract-documents'
import { getApiErrorMessage } from '~/utils/api-error'

export function usePortalContractDocuments() {
  const key = usePortalSessionKey('contract-documents')
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantContractDocument[]>>(
    '/api/tenant/contract-documents', { key, default: () => ({ data: [] }) },
  )
  const downloading = ref<string | null>(null)
  const downloadError = ref<string | null>(null)
  let generation = 0
  watch(key, () => {
    generation += 1
    downloading.value = null
    downloadError.value = null
  }, { flush: 'sync' })

  async function download(id: string) {
    if (downloading.value) return
    const actor = key.value
    const requestGeneration = generation
    const isCurrent = () => actor === key.value && requestGeneration === generation
    // Open synchronously so mobile browsers do not block a tab after the request resolves.
    const target = window.open('about:blank', '_blank')
    if (target) target.opener = null
    downloading.value = id
    downloadError.value = null
    try {
      const response = await apiFetch<ApiSuccess<{ url: string; expiresIn: number }>>(
        `/api/tenant/contract-documents/${encodeURIComponent(id)}/download`,
      )
      if (!isCurrent()) { target?.close(); return }
      if (target) target.location.replace(response.data.url)
      else window.location.assign(response.data.url)
    }
    catch (cause) {
      target?.close()
      if (isCurrent()) downloadError.value = getApiErrorMessage(cause, 'Không tải được hợp đồng. Vui lòng thử lại.')
    }
    finally {
      if (isCurrent()) downloading.value = null
    }
  }

  return { documents: computed(() => data.value?.data ?? []), status, error, refresh, downloading, downloadError, download }
}
