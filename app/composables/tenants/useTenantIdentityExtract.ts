import type { ApiSuccess } from '~/types/api'
import { getApiErrorMessage } from '~/utils/api-error'
import type { IdentitySuggestion } from '~/utils/validators/tenant-identity-extraction'

// Longer than the provider timeout so the server reports its own 504.
const EXTRACT_TIMEOUT_MS = 45_000

export function useTenantIdentityExtract(): {
  extract: (files: File[]) => Promise<IdentitySuggestion | null>
  abort: () => void
  loading: Ref<boolean>
  error: Ref<string | null>
} {
  const loading = ref(false)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  function abort() {
    controller?.abort()
    controller = null
    loading.value = false
  }

  async function extract(files: File[]): Promise<IdentitySuggestion | null> {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = null

    const body = new FormData()
    for (const file of files) body.append('images[]', file)

    try {
      const response = await apiFetch<ApiSuccess<IdentitySuggestion>>('/api/tenants/identity/extract', {
        method: 'POST',
        body,
        signal: current.signal,
        timeout: EXTRACT_TIMEOUT_MS,
      })
      return response.data
    }
    catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return null
      error.value = getApiErrorMessage(err, 'Không đọc được ảnh. Vui lòng nhập tay.')
      return null
    }
    finally {
      if (controller === current) {
        controller = null
        loading.value = false
      }
    }
  }

  return { extract, abort, loading, error }
}
