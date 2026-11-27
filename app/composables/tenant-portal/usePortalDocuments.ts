import type { ApiSuccess } from '~/types/api'
import type { TenantDocument } from '~/types/tenant-portal'
import { uploadWithProgress } from '~/utils/upload'
import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * Free-form tenant documents bound to the archived `tenant-documents`
 * convention. Uploads report progress without repeating a non-idempotent POST; the server
 * owns path/bucket selection and returns short-lived signed URLs.
 */
export function usePortalDocuments() {
  const sessionKey = usePortalSessionKey('documents')
  const { data, status, error, refresh: refreshDocuments } = useFetch<ApiSuccess<TenantDocument[]>>(
    '/api/tenant/documents',
    { key: sessionKey, default: () => ({ data: [] }) },
  )

  const documents = computed(() => data.value?.data ?? [])
  const uploading = ref(false)
  const progress = ref(0)
  let generation = 0
  let uploadController: AbortController | null = null
  const removeControllers = new Map<string, AbortController>()

  function invalidateMutations() {
    generation++
    uploadController?.abort()
    uploadController = null
    for (const controller of removeControllers.values()) controller.abort()
    removeControllers.clear()
    uploading.value = false
    progress.value = 0
  }
  watch(sessionKey, invalidateMutations, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(invalidateMutations)

  const cancelled = () => new DOMException('Thao tác đã dừng. Vui lòng thử lại trong phiên hiện tại.', 'AbortError')

  async function refresh() {
    invalidateMutations()
    await refreshDocuments()
  }

  async function upload(file: File): Promise<TenantDocument> {
    if (uploading.value) throw new Error('Đang tải tài liệu. Vui lòng đợi thao tác hiện tại hoàn tất.')
    const actor = sessionKey.value
    const version = generation
    const controller = new AbortController()
    uploadController = controller
    const isCurrent = () => actor === sessionKey.value && version === generation && !controller.signal.aborted
    const form = new FormData()
    form.append('document', file, file.name)
    uploading.value = true
    progress.value = 0
    try {
      const res = await uploadWithProgress<ApiSuccess<TenantDocument>>(
        '/api/tenant/documents',
        form,
        { retries: 0, signal: controller.signal, onProgress: pct => { if (isCurrent()) progress.value = pct } },
      )
      if (!isCurrent()) throw cancelled()
      if (data.value) data.value = { ...data.value, data: [res.data, ...data.value.data] }
      return res.data
    }
    catch (cause) {
      if (!isCurrent()) throw cancelled()
      throw cause
    }
    finally {
      if (isCurrent()) {
        uploading.value = false
        uploadController = null
      }
    }
  }

  async function remove(id: string): Promise<void> {
    if (removeControllers.has(id)) return
    const actor = sessionKey.value
    const version = generation
    const controller = new AbortController()
    removeControllers.set(id, controller)
    const isCurrent = () => actor === sessionKey.value && version === generation && !controller.signal.aborted
    const removed = data.value?.data.find(document => document.id === id)
    // Optimistic removal — reconcile on error.
    if (data.value) {
      data.value = { ...data.value, data: data.value.data.filter(doc => doc.id !== id) }
    }
    try {
      await apiFetch(`/api/tenant/documents/${encodeURIComponent(id)}`, { method: 'DELETE', signal: controller.signal })
      if (!isCurrent()) throw cancelled()
    }
    catch (e) {
      if (!isCurrent()) throw cancelled()
      // Restore only this document, preserving concurrent uploads/deletions.
      if (removed && data.value && !data.value.data.some(document => document.id === id)) {
        data.value = { ...data.value, data: [...data.value.data, removed]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt)) }
      }
      throw e
    }
    finally {
      if (removeControllers.get(id) === controller) removeControllers.delete(id)
    }
  }

  return { documents, status, error, refresh, upload, remove, uploading, progress }
}
