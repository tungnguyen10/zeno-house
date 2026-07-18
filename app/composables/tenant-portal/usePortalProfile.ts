import type { ApiSuccess } from '~/types/api'
import type { TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'
import { getApiErrorMessage } from '~/utils/api-error'

/** Maps the snake_case whitelist input onto the camelCase profile DTO for optimistic display. */
function applyOptimistic(profile: TenantProfile, input: TenantProfileUpdateInput): TenantProfile {
  return {
    ...profile,
    ...(input.full_name !== undefined ? { fullName: input.full_name } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    ...(input.date_of_birth !== undefined ? { dateOfBirth: input.date_of_birth } : {}),
    ...(input.occupation !== undefined ? { occupation: input.occupation } : {}),
    ...(input.permanent_address !== undefined ? { permanentAddress: input.permanent_address } : {}),
    ...(input.id_number !== undefined ? { idNumber: input.id_number } : {}),
    ...(input.id_issued_date !== undefined ? { idIssuedDate: input.id_issued_date } : {}),
    ...(input.id_issued_place !== undefined ? { idIssuedPlace: input.id_issued_place } : {}),
    ...(input.emergency_contact_name !== undefined
      ? { emergencyContactName: input.emergency_contact_name }
      : {}),
    ...(input.emergency_contact_phone !== undefined
      ? { emergencyContactPhone: input.emergency_contact_phone }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  }
}

export function usePortalProfile() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantProfile>>('/api/tenant/me', {
    key: 'portal-profile',
  })

  const profile = computed(() => data.value?.data ?? null)
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
      return false
    }

    const previous = data.value
    if (data.value?.data) {
      data.value = { ...data.value, data: applyOptimistic(data.value.data, parsed.data) }
    }

    saving.value = true
    try {
      const res = await apiFetch<ApiSuccess<TenantProfile>>('/api/tenant/me', {
        method: 'PATCH',
        body: parsed.data,
      })
      data.value = res
      return true
    }
    catch (e: unknown) {
      data.value = previous
      apiError.value = getApiErrorMessage(e)
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { profile, status, error, refresh, save, saving, fieldErrors, apiError }
}
