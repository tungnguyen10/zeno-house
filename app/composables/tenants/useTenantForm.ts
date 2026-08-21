import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'
import { tenantCreateSchema, tenantUpdateSchema } from '~/utils/validators/tenants'
import type { TenantCreateInput, TenantUpdateInput } from '~/utils/validators/tenants'
import { tenantPath } from '~/utils/routes/operational'
import { useLocalFormDraft } from '~/composables/useLocalFormDraft'
import { useFormState } from '~/composables/useFormState'

type DraftKey =
  | { mode: 'create' }
  | { mode: 'edit'; id: string }
  | null

interface UseTenantFormOptions<T> {
  draftKey?: DraftKey
  formData?: Ref<T>
  initialSnapshot?: MaybeRef<T | null>
}

interface TenantSubmitOptions {
  skipRedirect?: boolean
}

function buildStorageKey(key: NonNullable<DraftKey>): string {
  return key.mode === 'create'
    ? 'tenant-form:create'
    : `tenant-form:edit:${key.id}`
}

export function useTenantForm<T = unknown>(options: UseTenantFormOptions<T> = {}) {
  const { isLoading, errors, apiError, clearErrors, applyZodErrors, applyApiError } = useFormState()

  const storageKey = options.draftKey ? buildStorageKey(options.draftKey) : null

  const { hasDraft, isDirty, restoreDraft, clearDraft, refreshHasDraft } = useLocalFormDraft<T>({
    key: storageKey,
    formData: options.formData,
    initialSnapshot: options.initialSnapshot,
  })

  async function submitCreate(input: TenantCreateInput, options: TenantSubmitOptions = {}): Promise<Tenant | null> {
    clearErrors()

    const result = tenantCreateSchema.safeParse(input)
    if (!result.success) {
      applyZodErrors(result.error)
      return null
    }

    isLoading.value = true
    try {
      const res = await apiFetch<ApiSuccess<Tenant>>('/api/tenants', {
        method: 'POST',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      if (!options.skipRedirect) {
        await navigateTo(res.data ? tenantPath(res.data) : '/dashboard/tenants')
      }
      return res.data ?? null
    }
    catch (e: unknown) {
      applyApiError(e)
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  async function submitUpdate(id: string, input: TenantUpdateInput, options: TenantSubmitOptions = {}): Promise<Tenant | null> {
    clearErrors()

    const result = tenantUpdateSchema.safeParse(input)
    if (!result.success) {
      applyZodErrors(result.error)
      return null
    }

    isLoading.value = true
    try {
      const res = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`, {
        method: 'PATCH',
        body: result.data,
      })
      clearDraft()
      clearNuxtData()
      if (!options.skipRedirect) {
        await navigateTo(res.data ? tenantPath(res.data) : `/dashboard/tenants/${id}`)
      }
      return res.data ?? null
    }
    catch (e: unknown) {
      applyApiError(e)
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    errors,
    apiError,
    submitCreate,
    submitUpdate,
    isDirty,
    hasDraft,
    restoreDraft,
    clearDraft,
    refreshHasDraft,
  }
}
