import type { ApiSuccess } from '~/types/api'
import type { TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'
import { getTenantApiError } from '~/utils/tenant-api-error'
import { usePortalBootstrap } from './usePortalBootstrap'

/** Maps the snake_case whitelist input onto the camelCase profile DTO for optimistic display. */
function applyOptimistic(profile: TenantProfile, input: TenantProfileUpdateInput): TenantProfile {
  return {
    ...profile,
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.occupation !== undefined ? { occupation: input.occupation } : {}),
    ...(input.emergency_contact_name !== undefined
      ? { emergencyContactName: input.emergency_contact_name }
      : {}),
    ...(input.emergency_contact_phone !== undefined
      ? { emergencyContactPhone: input.emergency_contact_phone }
      : {}),
  }
}

export function usePortalProfile() {
  const { data, status, error, refresh } = usePortalBootstrap()

  const profile = computed(() => data.value?.data.profile ?? null)
  const saving = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)

  /** Optimistically applies the change, then reconciles or rolls back on error. */
  async function save(input: TenantProfileUpdateInput): Promise<boolean> {
    fieldErrors.value = {}
    apiError.value = null

    const parsed = tenantProfileUpdateSchema.safeParse(input)
    if (!parsed.success) {
      fieldErrors.value = parsed.error.flatten().fieldErrors as Record<string, string[]>
      if (parsed.error.issues.some(issue => issue.code === 'unrecognized_keys')) {
        apiError.value = 'Dữ liệu hồ sơ không còn phù hợp. Vui lòng tải lại trang và thử lại.'
      }
      return false
    }

    const previous = data.value
    if (data.value?.data.profile) {
      data.value = {
        ...data.value,
        data: {
          ...data.value.data,
          profile: applyOptimistic(data.value.data.profile, parsed.data),
        },
      }
    }

    saving.value = true
    try {
      const res = await apiFetch<ApiSuccess<TenantProfile>>('/api/tenant/me', {
        method: 'PATCH',
        body: parsed.data,
      })
      if (data.value) {
        data.value = { ...data.value, data: { ...data.value.data, profile: res.data } }
      }
      return true
    }
    catch (e: unknown) {
      data.value = previous
      const failure = getTenantApiError(e)
      fieldErrors.value = failure.fieldErrors
      apiError.value = failure.message
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { profile, status, error, refresh, save, saving, fieldErrors, apiError }
}
