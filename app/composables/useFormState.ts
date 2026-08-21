import type { ZodError } from 'zod'
import { getApiErrorMessage } from '~/utils/api-error'

/** Shared loading + validation/API error state for form composables. */
export function useFormState() {
  const isLoading = ref(false)
  const errors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  function clearErrors() {
    errors.value = {}
    apiError.value = null
  }

  /** Populates field-level errors from a failed Zod parse. */
  function applyZodErrors(error: ZodError) {
    errors.value = error.flatten().fieldErrors as Record<string, string[]>
  }

  /** Resolves a thrown API error into a user-facing message. */
  function applyApiError(error: unknown) {
    apiError.value = getApiErrorMessage(error)
  }

  return { isLoading, errors, apiError, clearErrors, applyZodErrors, applyApiError }
}
