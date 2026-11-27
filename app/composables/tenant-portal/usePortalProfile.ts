import type { ApiSuccess } from '~/types/api'
import type { TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'
import { getTenantApiError } from '~/utils/tenant-api-error'
import { usePortalBootstrap } from './usePortalBootstrap'
import { getCurrentScope, onScopeDispose } from 'vue'

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
  const sessionKey = usePortalSessionKey('bootstrap')
  const { data, status, error, refresh: refreshBootstrap } = usePortalBootstrap()

  const profile = computed(() => data.value?.data.profile ?? null)
  const saving = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const apiError = ref<string | null>(null)
  let generation = 0
  let saveController: AbortController | null = null

  function invalidateSave() {
    generation++
    saveController?.abort()
    saveController = null
    saving.value = false
    fieldErrors.value = {}
    apiError.value = null
  }
  watch(sessionKey, invalidateSave, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(invalidateSave)

  async function refresh() {
    invalidateSave()
    await refreshBootstrap()
  }

  /** Optimistically applies the change, then reconciles or rolls back on error. */
  async function save(input: TenantProfileUpdateInput): Promise<boolean> {
    if (saving.value) return false
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

    const actor = sessionKey.value
    const version = ++generation
    const controller = new AbortController()
    saveController = controller
    const isCurrent = () => actor === sessionKey.value && version === generation && !controller.signal.aborted
    const previousProfile = data.value?.data.profile ?? null
    if (data.value?.data.profile) {
      data.value = {
        ...data.value,
        data: {
          ...data.value.data,
          profile: applyOptimistic(data.value.data.profile, parsed.data),
        },
      }
    }
    const optimisticProfile = data.value?.data.profile

    saving.value = true
    try {
      const res = await apiFetch<ApiSuccess<TenantProfile>>('/api/tenant/me', {
        method: 'PATCH',
        body: parsed.data,
        signal: controller.signal,
      })
      if (!isCurrent()) return false
      if (data.value) {
        data.value = { ...data.value, data: { ...data.value.data, profile: res.data } }
      }
      return true
    }
    catch (e: unknown) {
      if (!isCurrent()) return false
      // Preserve any newer bootstrap response instead of restoring its old
      // invoices, balances or another refresh's authoritative profile.
      if (data.value && data.value.data.profile === optimisticProfile) {
        data.value = { ...data.value, data: { ...data.value.data, profile: previousProfile } }
      }
      const failure = getTenantApiError(e)
      fieldErrors.value = failure.fieldErrors
      apiError.value = failure.message
      return false
    }
    finally {
      if (isCurrent()) {
        saving.value = false
        saveController = null
      }
    }
  }

  return { profile, status, error, refresh, save, saving, fieldErrors, apiError }
}
