import type { ApiSuccess } from '~/types/api'
import type { TenantDocument } from '~/types/tenant-portal'
import { uploadWithProgress } from '~/utils/upload'

/**
 * Free-form tenant documents bound to the archived `tenant-documents`
 * convention. Uploads report progress and retry on flaky networks; the server
 * owns path/bucket selection and returns short-lived signed URLs.
 */
export function usePortalDocuments() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantDocument[]>>(
    '/api/tenant/documents',
    { key: 'portal-documents', default: () => ({ data: [] }) },
  )

  const documents = computed(() => data.value?.data ?? [])
  const uploading = ref(false)
  const progress = ref(0)

  async function upload(file: File): Promise<TenantDocument> {
    const form = new FormData()
    form.append('document', file, file.name)
    uploading.value = true
    progress.value = 0
    try {
      const res = await uploadWithProgress<ApiSuccess<TenantDocument>>(
        '/api/tenant/documents',
        form,
        { retries: 2, onProgress: pct => (progress.value = pct) },
      )
      if (data.value) data.value = { ...data.value, data: [res.data, ...data.value.data] }
      return res.data
    }
    finally {
      uploading.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    const previous = data.value
    // Optimistic removal — reconcile on error.
    if (data.value) {
      data.value = { ...data.value, data: data.value.data.filter(doc => doc.id !== id) }
    }
    try {
      await apiFetch(`/api/tenant/documents/${id}`, { method: 'DELETE' })
    }
    catch (e) {
      data.value = previous
      throw e
    }
  }

  return { documents, status, error, refresh, upload, remove, uploading, progress }
}
