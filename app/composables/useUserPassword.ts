import type { UserPasswordChangeInput } from '~/utils/validators/users'
import { userPasswordChangeSchema } from '~/utils/validators/users'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

interface ValidationDetails {
  fieldErrors?: Record<string, string[]>
}

export function useUserPassword() {
  const saving = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  async function change(input: UserPasswordChangeInput): Promise<boolean> {
    fieldErrors.value = {}
    apiError.value = null

    const parsed = userPasswordChangeSchema.safeParse(input)
    if (!parsed.success) {
      fieldErrors.value = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return false
    }

    saving.value = true
    try {
      await apiFetch('/api/users/me/password', { method: 'POST', body: parsed.data })
      return true
    }
    catch (err) {
      const details = getApiErrorDetails<ValidationDetails>(err)
      fieldErrors.value = details?.fieldErrors ?? {}
      apiError.value = getApiErrorMessage(err)
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { change, saving, fieldErrors, apiError }
}
