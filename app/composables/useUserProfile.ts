import type { ApiSuccess } from '~/types/api'
import type { UserProfile } from '~/types/users'
import { userProfileUpdateSchema } from '~/utils/validators/users'
import { getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'
import { uploadWithProgress } from '~/utils/upload'

interface ValidationDetails {
  fieldErrors?: Record<string, string[]>
}

export function useUserProfile() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<UserProfile>>('/api/users/me', {
    key: 'current-user-profile',
  })

  const profile = computed(() => data.value?.data ?? null)
  const saving = ref(false)
  const uploadingAvatar = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  async function updateFullName(fullName: string): Promise<boolean> {
    fieldErrors.value = {}
    apiError.value = null

    const parsed = userProfileUpdateSchema.safeParse({ full_name: fullName })
    if (!parsed.success) {
      fieldErrors.value = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return false
    }

    saving.value = true
    try {
      data.value = await apiFetch<ApiSuccess<UserProfile>>('/api/users/me', {
        method: 'PATCH',
        body: parsed.data,
      })
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

  async function uploadAvatar(file: File): Promise<boolean> {
    apiError.value = null
    uploadingAvatar.value = true
    try {
      const form = new FormData()
      form.append('avatar', file)
      data.value = await uploadWithProgress<ApiSuccess<UserProfile>>('/api/users/me/avatar', form)
      return true
    }
    catch (err) {
      apiError.value = getApiErrorMessage(err)
      return false
    }
    finally {
      uploadingAvatar.value = false
    }
  }

  async function removeAvatar(): Promise<boolean> {
    apiError.value = null
    try {
      data.value = await apiFetch<ApiSuccess<UserProfile>>('/api/users/me/avatar', { method: 'DELETE' })
      return true
    }
    catch (err) {
      apiError.value = getApiErrorMessage(err)
      return false
    }
  }

  return {
    profile,
    status,
    error,
    refresh,
    saving,
    uploadingAvatar,
    fieldErrors,
    apiError,
    updateFullName,
    uploadAvatar,
    removeAvatar,
  }
}
