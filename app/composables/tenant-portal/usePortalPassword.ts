import type { TenantPasswordChangeInput } from '~/utils/validators/tenant-portal'
import { tenantPasswordChangeSchema } from '~/utils/validators/tenant-portal'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

interface ValidationDetails {
  fieldErrors?: Record<string, string[]>
}

export function usePortalPassword() {
  const saving = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  async function change(input: TenantPasswordChangeInput): Promise<boolean> {
    fieldErrors.value = {}
    apiError.value = null

    const parsed = tenantPasswordChangeSchema.safeParse(input)
    if (!parsed.success) {
      fieldErrors.value = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return false
    }

    saving.value = true
    try {
      await apiFetch('/api/tenant/password', {
        method: 'POST',
        body: parsed.data,
      })
      return true
    }
    catch (error) {
      const details = getApiErrorDetails<ValidationDetails>(error)
      fieldErrors.value = details?.fieldErrors ?? {}
      apiError.value = getApiErrorMessage(error)
      return false
    }
    finally {
      saving.value = false
    }
  }

  return {
    change,
    saving,
    fieldErrors,
    apiError,
  }
}
