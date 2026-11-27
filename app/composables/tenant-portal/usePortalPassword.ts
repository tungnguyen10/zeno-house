import type { TenantPasswordChangeInput } from '~/utils/validators/tenant-portal'
import { tenantPasswordChangeSchema } from '~/utils/validators/tenant-portal'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

interface ValidationDetails {
  fieldErrors?: Record<string, string[]>
}

export function usePortalPassword() {
  const sessionKey = usePortalSessionKey('password-change')
  const saving = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)
  let activeRequest: AbortController | null = null
  watch(sessionKey, () => {
    activeRequest?.abort()
    activeRequest = null
    saving.value = false
    fieldErrors.value = {}
    apiError.value = null
  }, { flush: 'sync' })

  async function change(input: TenantPasswordChangeInput): Promise<boolean> {
    if (saving.value) return false
    const actor = sessionKey.value
    fieldErrors.value = {}
    apiError.value = null

    const parsed = tenantPasswordChangeSchema.safeParse(input)
    if (!parsed.success) {
      fieldErrors.value = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return false
    }

    saving.value = true
    const controller = new AbortController()
    activeRequest = controller
    const isCurrent = () => actor === sessionKey.value && activeRequest === controller
    try {
      await apiFetch('/api/tenant/password', {
        method: 'POST',
        body: parsed.data,
        signal: controller.signal,
      })
      return isCurrent()
    }
    catch (error) {
      if (!isCurrent()) return false
      const details = getApiErrorDetails<ValidationDetails>(error)
      fieldErrors.value = details?.fieldErrors ?? {}
      apiError.value = getApiErrorMessage(error)
      return false
    }
    finally {
      if (isCurrent()) {
        saving.value = false
        activeRequest = null
      }
    }
  }

  return {
    change,
    saving,
    fieldErrors,
    apiError,
  }
}
